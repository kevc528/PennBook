// Last refreshed time
let lastDateTime = new Date().toISOString();
let initial = true;

// Used for lazy loading (infinite scrolling)
let startId = "0"
let startDateTime = new Date().toISOString();
let allPostsLoaded = false;

$( document ).ready(function() {
    refreshTime();
    fillUserData();
    initEditProfile();
    initAddPost();
    initAddFriendForm();
    initScrollToBottom();
});

function initScrollToBottom() {
    $(window).scroll(function() {
        if($(window).scrollTop() + $(window).height() == $(document).height()) {
            loadWall();
        }
    });
}

/**
 * Refresh everything
 */
var refreshTime = function() {
    // Refresh Wall
    if (initial) {
        loadWall();
    } else {
        refreshWall();
    }
    initial = false;

    // Refresh friends list
    fillFriendsList();

    // Refresh friend requests
    fillFriendRequestData()

    // Refresh everything after 5 seconds
    setTimeout(refreshTime, 5000);
};

/**
 * Fill the information of the user
 */
function fillUserData() {
    $.getJSON("/api/users/getloggedin", function(item) {
        if (item.success) {
            let info = item.data;
            $("#fullname").html(info.name);
            $("#username").html(info.username);
            $("#birthday").html(info.birthday);
            $("#affiliation").html(info.affiliation);            
            var interestList = "";
            for (var i = 0; i < info.interests.length; i++) {
                interestList += "<dd>" + info.interests[i] + "</dd>";
            }
            $("#interests").html(interestList);
            
        } else {
            alert("An error occurred while obtaining your profile info");
        }
    });
}

/**
 * Fill the friends list of the user
 */
function fillFriendsList() {
    $.getJSON("/api/users/getloggedin", function(item) {
        if (item.success) {
            let info = item.data;
            $.getJSON("/api/friends/getall", {username: info.username}, function(response) {
                if (response.success) {
                    $('#friends-list').empty();
                    let onlineFriendsList = response.data.online;
                    let sortedOnline = onlineFriendsList.sort((a, b) => (a > b ? 1 : -1));
                    sortedOnline.forEach((friend) => {
                        let friendElement = $(`
                        <li class='list-group-item d-flex justify-content-between align-items-center'> 
                            <span><a href="/user?username=${friend}"><b class='friend-username'>${friend}</b></a>
                            <img src='/public/images/online_circle.png' style='height:5px;margin-top:-2px'></span>
                            <span class='friend-btns'>
                                <span class='chat-with-friend-btn' type='button'><img src='/public/images/blue_chat_facebook.webp' style='height:16px;'></span>
                                <span class='remove-friend-btn' type='button'><img src='/public/images/x_symbol.png' style='height:10px;'></span>
                            </span>
                        </li>`);
                        initRemoveFriendButton(friendElement);
                        initChatWithFriendButton(friendElement);
                        $('#friends-list').append(friendElement);
                    });
            
                    let offlineFriendsList = response.data.offline;
                    let sortedOffline = offlineFriendsList.sort((a, b) => (a > b ? 1 : -1));
                    sortedOffline.forEach((friend) => {
                        let friendElement = $(`
                        <li class='list-group-item d-flex justify-content-between align-items-center'> 
                            <a href="/user?username=${friend}"><span class='friend-username'>${friend}</span></a>
                            <span class='friend-btns'>
                                <span class='remove-friend-btn' type='button'><img src='/public/images/x_symbol.png' style='height:10px;'></span>
                            </span>
                        </li>`);
                        initRemoveFriendButton(friendElement);
                        $('#friends-list').append(friendElement);
                    });
                } else {
                    alert("An error occurred while obtaining your friends");
                }
            });
        } else {
            alert("An error occurred while obtaining your profile info");
        }
    });
}

/**
 * Load all of the user's posts
 * Uses displayFeed() from feed.js to show the posts to the user
 * Includes news recommendations since this is your own wall
 */
function loadWall() {
    if (allPostsLoaded) {
        return;
    }
    let user;
    $.when(
        $.getJSON("/api/users/getloggedin", function(item) {
            if (item.success === true) {
                let info = item.data;
                user = info.username;
            }
        })
    ).then(function() {
        $.getJSON("/api/posts/getwall", {username: user, startId: startId, startDatetime: startDateTime}, function(item) {
            if (item.success === true) {
                if (item.data.posts && item.data.posts.length) {
                    let newFeedItems = item.data.posts;
                    let sorted = newFeedItems.sort((a, b) => (new Date(a.datetime).getTime() < new Date(b.datetime).getTime()) ? 1 : -1);
                    displayFeed(sorted, $("#wall-post-section"), true)
                    if (!item.data.LastEvaluatedKey) {
                        allPostsLoaded = true;
                    } else {
                        startId = item.data.LastEvaluatedKey.id;
                        startDateTime = item.data.LastEvaluatedKey.datetime;
                    }
                } else {
                    allPostsLoaded = true;
                }
            } else {
                console.log("An error occurred finding your posts");
            }
            if (allPostsLoaded) {
                $('#all-posts-shown').show();
            }
        })
    })
}

/**
 * Refresh to obtain more posts to prepend to the feed
 * Also refreshes comments for all existing posts
 */
function refreshWall() {
    refreshPostComments($("#wall-post-section"));

    var user;

    let newFeedItems = [];

    // The forward makes it so DynamoDB only obtains posts after lastDateTime
    let forward = "1";
    
    $.when(
        $.getJSON("/api/users/getloggedin", function(item) {
            if (item.success === true) {
                let info = item.data;
                user = info.username;
            }
        })
    ).then(function() {
        $.getJSON("/api/posts/getwall?username=" + user + "&startDatetime=" + lastDateTime + "&startId=0&forward=" + forward, function(result) {
            if (result.success) {
                if (result.data.posts) {
                    let posts = result.data.posts;
                    posts.forEach((post) => {
                        if (!($(".post-id:contains('" + post.id + "')").length)) {
                            newFeedItems.push(post);
                        }
                    });
                    let sorted = newFeedItems.sort((a, b) => (new Date(a.datetime).getTime() < new Date(b.datetime).getTime()) ? 1 : -1);
                    displayFeed(sorted, $("#wall-post-section"));
                    if (sorted.length) {
                        lastDateTime = sorted[0].datetime;
                    }
                } else {
                    if (initial) {
                        var postList = "<p id='empty-wall'>" + "Your wall is empty. Create your first post!" + "</p>";
                        $("#wall-post-section").html(postList);
                    }
                }
            }
        });          
    });
}


/**
 * Display inoming friend requests
 */
function fillFriendRequestData() {
    var user;
    $.when(
        $.getJSON("/api/users/getloggedin", function(item) {
            if (item.success === true) {
                let info = item.data;
                user = info.username;
            }
        })
    ).then(function() {
        $.getJSON("/api/friends/getrequests?username=" + user, function(result) {
            if (result.success) {
                $("#friend-requests-list").empty();
                let requests = result.data;
                let sortedRequests = requests.sort((a, b) => (a > b ? 1 : -1));
                sortedRequests.forEach((friend) => {
                    let friendRequest = $(`
                    <li class='list-group-item d-flex justify-content-between align-items-center'>
                        <div class='req'>
                            <a href="/user?username=${friend}"><span class='request-username'>${friend}</span></a>
                            <span class='edit-req-btns'>
                                <span class='accept-req' type='button'><img src='/public/images/check_symbol.png' style='height:10px;'></span>
                                <span class='delete-req' type='button'><img src='/public/images/x_symbol.png' style='height:10px;'></span> 
                            </span>
                        </div>
                    </li>`)
                    initDeleteRequestButton(friendRequest);
                    initAcceptRequestButton(friendRequest);
                    $("#friend-requests-list").append(friendRequest);
                });
            } else {
                alert("An error occurred while obtaining your friend requests.");
            }
        });          
    });
}

/**
 * Initialize button to edit your own profile
 */
function initEditProfile() {
    $('#edit-profile-form').on('submit', function(e) {
        e.preventDefault();
        window.location.href = "/settings";
    });
}

/**
 * Initialize form to add a new post to the wall
 */
function initAddPost() {
    $("#new-post-content").val("");
    $('#add-post-form').on('submit', function(e) {
        e.preventDefault();
        var user;
        $.when(
            $.getJSON("/api/users/getloggedin", function(item) {
                if (item.success === true) {
                    let info = item.data;
                    user = info.username;
                }
            })
        ).then(function() {
            $.post('/api/posts/create', { 
                username: user, 
                content: $("#new-post-content").val(),
            },
            function(data) {
                if (data.success) {
                    $("#new-post-content").val("");
                    refreshWall();
                }
            }, 'json');
        });
    });
}

/**
 * Initialize form to add a friend by search
 */
function initAddFriendForm() {
    $('#add-friend-form').on('submit', function(e) {
        e.preventDefault();
        $.post('/api/friends/request', $('#add-friend-form').serialize(), function(data) {
            if (data.success) {
                alert("Friend request sent!");
                $("#add-friend-text").val("");
            } else {
                console.log(data);
                alert(data.error);
            }
        }, 'json');
    });
}

/**
 * Initialize button to remove a specific friend
 */
function initRemoveFriendButton(friendElement) {
    let toRemove = friendElement.find('.friend-username').html();
    let removeButton = friendElement.find('.remove-friend-btn');

    removeButton.click(function() {
        let confirmRemove = confirm("Remove '" + toRemove + "' as a friend?");
        if (confirmRemove) {
            $.ajax({
                url: '/api/friends/delete',
                type: 'DELETE',
                data: {username: toRemove},
                success: function(response) {
                    if (response.success) {
                        fillFriendsList();
                        fillFriendRequestData()
                    } else {
                        alert("An error occurred while removing this friend: " + data);
                    }
                }
            });
        }
    });
}

/**
 * Initialize button to chat with a specific friend
 */
function initChatWithFriendButton(friendElement) {
    let toChat = friendElement.find('.friend-username').html();
    let chatButton = friendElement.find('.chat-with-friend-btn');

    let user;

    $.when(
        $.getJSON("/api/users/getloggedin", function(item) {
            if (item.success === true) {
                let info = item.data;
                user = info.username;
            }
        })
    ).then(function() {
        chatButton.click(function() {
            $.getJSON(`/api/chats/getprivate?username=${toChat}`, function(chatRes) {
                if (chatRes.success) {
                    if (chatRes.chatId) {
                        let myMembership = chatRes.members.find(el => el.username === user)
                        let otherMembership = chatRes.members.find(el => el.username === toChat)

                        if (!myMembership) {
                            let confirmJoin = confirm('You have previously been invited, but rejected. Do you want to join now?')
                            if (confirmJoin) {
                                $.post('/api/chat-memberships/joinprivate', 
                                {
                                    'chatId': chatRes.chatId
                                },
                                function(res) {
                                    if (res.success) {
                                        socket.emit('chat accept', chatRes.chatId, user)
                                        window.location.href = `/chatroom?id=${chatRes.chatId}`
                                    } else {
                                        alert('An error has occured creating the new invite')
                                    }
                                })
                            }
                        } else if (!myMembership.accepted) {
                            let confirmAccept = confirm("You have been invited already. Do you want to accept?")
                            if (confirmAccept) {
                                $.ajax({
                                    url: '/api/chat-memberships/acceptinvite',
                                    type: 'PATCH',
                                    data: {chatId: chatRes.chatId},
                                    success: function(response) {
                                        if (response.success) {
                                            let chatInvites = JSON.parse(sessionStorage.getItem('chat-invites'))
                                            chatInvites = chatInvites.filter(x => x[1] !== chatRes.chatId)
                                            sessionStorage.setItem('chat-invites', JSON.stringify(chatInvites));
                                            socket.emit('chat accept', chatRes.chatId, user)
                                            window.location.href = `/chatroom?id=${chatRes.chatId}`
                                        } else {
                                            console.log(response.error)
                                            alert("An error occurred while accepting this invite.");
                                        }
                                    }
                                }); 
                            }
                        } else if (!otherMembership) {
                            // Other person has previously rejected
                            let confirmInvite = confirm('You have previously invited this user, but they rejected. Invite again?')
                            if (confirmInvite) {
                                $.post('/api/chat-memberships/invite', 
                                {
                                    'username': toChat,
                                    'chatId': chatRes.chatId
                                },
                                function(res) {
                                    if (res.success) {
                                        socket.emit('chat invite', user, toChat, chatRes.chatId)
                                    } else {
                                        alert('An error has occured creating the new invite')
                                    }
                                })
                            }
                            window.location.href = `/chatroom?id=${chatRes.chatId}`
                        } else {
                            window.location.href = `/chatroom?id=${chatRes.chatId}`
                        }
                    } else {
                        // chat does not exist
                        let confirmChat = confirm("Open a chat with '" + toChat + "'?");
                        if (confirmChat) {
                            $.post(`/api/chats/create`,
                                {
                                    'type': 0,
                                    'users': [toChat]
                                },
                                function(res) {
                                    if (res.success) {
                                        socket.emit('chat invite', user, toChat, res.data.chatId)
                                        window.location.href = `/chatroom?id=${res.data.chatId}`
                                    } else {
                                        alert('An error has occured creating the chat')
                                    }
                                }
                            )
                        }
                    }
                } else {
                    alert('An error has occured checking if chat exists')
                }
            })
        });
    })
}

/**
 * Initialize form to accept an incoming friend request
 */
function initAcceptRequestButton(friendRequest) {
    let toAccept = friendRequest.find('.request-username').html();
    let acceptButton = friendRequest.find('.accept-req');
    
    acceptButton.click(function() {
        $.ajax({
            url: '/api/friends/accept',
            type: 'PATCH',
            data: {username: toAccept},
            success: function(response) {
                if (response.success) {
                    refreshWall();
                    fillFriendsList();
                    fillFriendRequestData()
                } else {
                    alert("An error occurred adding this friend.");
                }
            }
        });
    });
}

/**
 * Initialize form to delete an incoming friend request
 */
function initDeleteRequestButton(friendRequest) {
    let toDelete = friendRequest.find('.request-username').html();
    let deleteButton = friendRequest.find('.delete-req');

    deleteButton.click(function() {
        let confirmDelete = confirm("Delete " + toDelete + "'s friend request?");
        if (confirmDelete) {
            $.ajax({
                url: '/api/friends/delete',
                type: 'DELETE',
                data: {username: toDelete},
                success: function(response) {
                    if (response.success) {
                        fillFriendsList();
                        fillFriendRequestData()
                    } else {
                        alert("An error occurred while removing this friend request.");
                    }
                }
            });
        }
    });
}




