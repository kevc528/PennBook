// Last refreshed time
let lastDateTime = new Date().toISOString();
let initial = true;

// Used for lazy loading (infinite scrolling)
let startId = "0"
let startDateTime = new Date().toISOString();
let allPostsLoaded = false;

let user;

$( document ).ready(function() {
    let searchParams = new URLSearchParams(window.location.search);
    
    if (searchParams.has('username')) {
        user = searchParams.get('username');
        refreshTime();
        fillUserData();
        initScrollToBottom();
        
        $.getJSON("/api/users/getloggedin", function(item) {
            if (item.success === true) {
                fillFriendStatus();
                initAddPost();
            }
        });
    } else {
        $('#error-alert').html("Failed to load any user data.");
        $('#error-alert').show();
    }
});

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

    // Refresh friends list and status
    fillFriendsList();
    fillFriendStatus();

    // Refresh everything after 5 seconds
    setTimeout(refreshTime, 5000);
};


/**
 * Initializes functionality when scrolling to the bottom of the page
 */
function initScrollToBottom() {
    $(window).scroll(function() {
        if($(window).scrollTop() + $(window).height() == $(document).height()) {
            loadWall();
        }
    });
}

/**
 * Fill the information of the user
 */
function fillUserData() {
    $.getJSON("/api/users/profile?username=" + user, function(item) {
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
 * Load all of the user's posts
 * Uses displayFeed() from feed.js to show the posts to the user
 */
function loadWall() {
    if (allPostsLoaded) {
        return;
    }
    $.getJSON("/api/posts/getwall", {username: user, startId: startId, startDatetime: startDateTime}, function(item) {
        if (item.success === true) {
            if (item.data.posts && item.data.posts.length) {
                let newFeedItems = item.data.posts;
                let sorted = newFeedItems.sort((a, b) => (new Date(a.datetime).getTime() < new Date(b.datetime).getTime()) ? 1 : -1);
                displayFeed(sorted, $("#wall-post-section"), true, true)
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
}

/**
 * Refresh to obtain more posts to prepend to the feed
 * Also refreshes comments for all existing posts
 */
function refreshWall() {
    refreshPostComments($("#wall-post-section"));

    let newFeedItems = [];

    // The forward makes it so DynamoDB only obtains posts after lastDateTime
    let forward = "1";
    
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
                displayFeed(sorted, $("#wall-post-section"), false, true);
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
}

/**
 * Fill the friends list of the user
 */
function fillFriendsList() {
    $.getJSON("/api/friends/getall", {username: user}, function(response) {
        if (response.success) {
            $('#friends-list').empty();
            let onlineFriendsList = response.data.online;
            let sortedOnline = onlineFriendsList.sort((a, b) => (a > b ? 1 : -1));
            sortedOnline.forEach((friend) => {
                let friendElement = $(`
                <li class='list-group-item d-flex justify-content-between align-items-center'> 
                    <span><a href="/user?username=${friend}"><b class='friend-username'>${friend}</b></a>
                    <img src='/public/images/online_circle.png' style='height:5px;margin-top:-2px'></span>
                </li>`);
                $('#friends-list').append(friendElement);
            });
    
            let offlineFriendsList = response.data.offline;
            let sortedOffline = offlineFriendsList.sort((a, b) => (a > b ? 1 : -1));
            sortedOffline.forEach((friend) => {
                let friendElement = $(`
                <li class='list-group-item d-flex justify-content-between align-items-center'> 
                    <a href="/user?username=${friend}"><span class='friend-username'>${friend}</span></a>
                </li>`);
                $('#friends-list').append(friendElement);
            });
        } else {
            alert("An error occurred while obtaining your friends");
        }
    });
}

/**
 * Initialize the form to add a new post to the user's wall
 */
function initAddPost() {
    $.getJSON("/api/friends/status?username=" + user, function(item) {
        if (item.status === 'Friends') {
            
            $('#add-post-section').show();
            $("#new-post-content").val("");
            $('#add-post-form').on('submit', function(e) {
                e.preventDefault();
                $.post('/api/posts/create', { 
                    username: user, 
                    content: $("#new-post-content").val()
                },
                function(data) {
                    if (data.success) {
                        $("#new-post-content").val("");
                        refreshWall();
                    }
                }, 'json');
            });
        }
    });
}

/**
 * Display the friendship status of the user with yourself 
 */
function fillFriendStatus() {
    $.getJSON("/api/friends/status?username=" + user, function(item) {
        if (item.status === 'Not friends') {
            $('#friend-status').show();
            let friendStatus = $(`<p><small>You are not friends with <span id="to-add">${user}</span>.</small></p>
                                <form id="send-friend-req"><button type="submit" class="btn btn-primary btn-sm ml-2">Add
            </form></button>`);
            $('#friend-status').html(friendStatus);
            
            $("#send-friend-req").on("submit", function(e) {
                e.preventDefault();
                
                $.post('/api/friends/request', {username: user}, function(data) {
                    if (data.success) {
                        alert("Friend request sent!");
                        let status = $(`<small id="friends-with">Your friend request is pending.</small>`);
                        $('#friend-status').html(status);
                    } else {
                        console.log(data);
                        alert(data.error);
                    }
                }, 'json');
            });
        } else if (item.status === 'Request sent') {
            $('#friend-status').show();
            let friendStatus = $(`<small id="friends-with">Your friend request is pending.</small>`);
            $('#friend-status').html(friendStatus);
        } else if (item.status === 'Request received') {
            $('#friend-status').show();
            let friendStatus = $(`<p><small><span id="to-accept">${user}</span> sent you a friend request.</small></p>
                                <form id="accept-friend-req"><button type="submit" class="btn btn-primary btn-sm ml-2">Add
            </form></button>`);
            $('#friend-status').html(friendStatus);
            $("#accept-friend-req").on("submit", function(e) {
                e.preventDefault();
                
                $.ajax({
                    url: '/api/friends/accept',
                    type: 'PATCH',
                    data: {username: user},
                    success: function(response) {
                        if (response.success) {
                            location.reload();
                        } else {
                            alert("An error occurred adding this friend.");
                        }
                    }
                });
            });
        } else if (item.status === 'Friends') {
            $('#friend-status').show();
            let friendStatus = $(`<small id="friends-with">You are friends with <span id="to-add">${user}!</span></small>`)
            $('#friend-status').html(friendStatus);
        }
    });
}
