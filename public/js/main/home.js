// Last refreshed time
let lastDateTime = new Date().toISOString();

// Used for pagination (infinite scrolling)
let initialDateTime = new Date().toISOString();
let page = 1;
let allPostsLoaded = false;

let initial = true;

$( document ).ready(function() {
    refreshTime();
    initScrollToBottom();
    loadChats();
});

/**
 * Refresh everything
 */
var refreshTime = function() {
    // Refresh main feed
    if (initial) {
        loadFeed();
    } else {
        refreshFeed();
    }
    initial = false;

    // Refresh after 5 seconds
    setTimeout(refreshTime, 5000);
};

/**
 * Initializes functionality when scrolling to the bottom of the page
 */
function initScrollToBottom() {
    $(window).scroll(function() {
        if($(window).scrollTop() + $(window).height() == $(document).height()) {
            loadFeed();
        }
    });
}

/**
 * Function to load all of the chats the user is a member in
 */
function loadChats() {
    $.getJSON("/api/chat-memberships/getall", function(chats) {
        if (chats.success) {
            chats.data.forEach(chat => {
                let recentMessage;
                if (chat.newest.type === 0) {
                    recentMessage = chat.newest.content
                } else if (chat.newest.type === 1){
                    recentMessage = "joined the chat";
                } else if (chat.newest.type === 2) {
                    recentMessage = "declined their invite"
                } else {
                    recentMessage = "left the chat"
                }

                recentMessage = recentMessage + chat.newest.author.length > 30 ?
                    recentMessage.substring(0, 28 - chat.newest.content.author)+ '...' : recentMessage

                $('#chat-list').append($(`
                    <li class="chat-listing border border-secondary" id="${chat.id}">
                        <h4 class="chat-name">${chat.name.length > 23 ? chat.name.substring(0, 22) + '...': chat.name}</h4>
                        <span>
                            <p class="chat-recent"><i><small><b>${chat.newest.author}</b>: ${recentMessage}</small></i></p>
                            <p class="chat-time">${moment(new Date(chat.newest.datetime)).fromNow()}</p>
                        </span>
                    </li>
                `))
            })

            $('#chat-list').on('click', '.chat-listing', function() {
                let chatId = $(this).attr('id')
                window.location.href = `/chatroom?id=${chatId}`
            })

            $('#createGroupsModal').on('hidden.bs.modal', function(e) {
                $(this).find("input").val('');
                $('#invitesfield').tokenfield('setTokens', [])
            })

            let user;

            $.when(
                $.getJSON("/api/users/getloggedin", function(item) {
                    if (item.success === true) {
                        user = item.data.username;
                    }
                })
            ).then(function() {
                $.getJSON(`/api/friends/getall?username=${user}`, function(res) {
                    if (res.success) {
                        let friends = res.data.online.concat(res.data.offline)
                        $('#invitesfield').tokenfield({
                            autocomplete: {
                                source: friends,
                                delay: 20
                            },
                            showAutocompleteOnFocus: true
                        })
                        $('#invitesfield').on('tokenfield:createtoken', function(event) {
                            if (!friends.includes(event.attrs.value)) {
                                event.preventDefault();
                                alert('You can only invite your friends!')
                            }
                        })
                    } else {
                        alert('There was an error loading your friends')
                    }
                })
            })

            $('#create-group-form').submit(function(e) {
                e.preventDefault();
                let invitees = $('#invitesfield').tokenfield('getTokens').map(x => x.value);

                let dups = [];
                dups = invitees.filter((item, index) => invitees.indexOf(item) != index);
                if (dups.length) {
                    alert("You cannot include the same user twice!");
                } else {
                    console.log(invitees)
                    $.post('/api/chats/create', 
                        {
                            'type': 1,
                            'name': $('#name').val(),
                            'users': invitees
                        },
                        function(res) {
                            if (!res.success) {
                                alert(res.err)
                            } else {
                                invitees.forEach(invitee => {
                                    socket.emit('chat invite', user, invitee, res.data.chatId)
                                })
                                window.location.href = `/chatroom?id=${res.data.chatId}`
                            }
                        }
                    )
                }
                
            });
        } else {
            alert("Error loading chats")
        }
    })
}

/**
 * Call the displayFeed() function from feed.js to show the feed to the user
 */
function loadFeed() {
    if (allPostsLoaded) {
        return;
    }
    $.getJSON("/api/posts/getwalloffriends", {startId: "0", initialDateTime: initialDateTime, page: page, noLimit: "1"}, function(item) {
        if (item.success === true) {
            let newFeedItems = item.posts;
            let sorted = newFeedItems.sort((a, b) => (new Date(a.datetime).getTime() < new Date(b.datetime).getTime()) ? 1 : -1);
            displayFeed(sorted, $("#feed-section"), true)
            page++;
        } else {
            if (item.err === "no more posts") {
                allPostsLoaded = true;
            }
        }
        if (allPostsLoaded) {
            $('#all-posts-shown').show();
        }
    })
}

/**
 * Function to prepend new posts to the top of the feed
 * Also refreshes the comments for all posts
 */
function refreshFeed() {
    
    refreshPostComments($("#feed-section"));

    let user;
    let friendsList;

    let newFeedItems = [];
    let promises = [];
    
    let forward = "1";
    
    $.when(
        $.getJSON("/api/users/getloggedin", function(item) {
            if (item.success === true) {
                user = item.data.username;
            }
        })
    ).then(function() {
        $.when(
            $.getJSON("/api/friends/getall", {username: user}, function(response) {
                if (response.success) {
                    let onlineFriendsList = response.data.online;
                    let offlineFriendsList = response.data.offline;
                    friendsList = onlineFriendsList.concat(offlineFriendsList);
                    friendsList.push(user);
                }
            })
        ).then(function() {
            friendsList.forEach((friend) => {
                promises.push(new Promise((resolve, reject) => {
                    $.getJSON("/api/posts/getwall?username=" + friend + "&startDatetime=" + lastDateTime + "&startId=0&forward=" + forward, function(result) {
                        if (result.success) {
                            if (result.data.posts) {
                                let posts = result.data.posts;
                                posts.forEach((post) => {
                                    if (!($(".post-id:contains('" + post.id + "')").length)) {
                                        post.wallUser = friend;
                                        newFeedItems.push(post);
                                    }
                                });
                            }
                        }
                        resolve();
                    });
                })) 
            })
            Promise.all(promises).then(() => {
                let sorted = newFeedItems.sort((a, b) => (new Date(a.datetime).getTime() < new Date(b.datetime).getTime()) ? 1 : -1);
                displayFeed(sorted, $("#feed-section"), false);
                if (sorted.length) {
                    lastDateTime = sorted[0].datetime;
                }
            });
        })     
    });
}
