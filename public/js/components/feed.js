/* 
* The displayFeed function takes as input a sorted list of feed items (posts, 
* status updates, friendships) and prepends them to a given jQuery element feedElement.
* Handles all button creations.
* To be used by profile.js, otherprofile.js, and home.js.
*/
function displayFeed(items, feedElement, isAppend, isOtherProfile) {
    let user;
    let newItems = false;

    $.when(
        $.getJSON("/api/users/getloggedin", function(item) {
            if (item.success === true) {
                let info = item.data;
                user = info.username;
            }
        })
    ).then(function() {
        let itemElement;
        let newPostsElement = $("<div></div>");
        items.forEach((item) => {
            newItems = true;
            let timePassed = moment(new Date(item.datetime)).fromNow();
            if (item.contentType === "post") {
                itemElement =
                $(`
                <div class='post border border-primary'> 
                    <div class='row post-header'> 
                        <h3 class='post-author'> 
                            <a id="post-author-link" href='/user?username=${item.author}'>${item.author}</a>
                            <small class="wall-user-text text-muted"> posted on <a href='/user?username=${item.wallUser}'>${item.wallUser}</a>'s wall</small>
                        </h3>
                        <div class='post-date'>${timePassed}</div>
                        <div class='dropdown'><a href='#' id='dropmenu' data-toggle='dropdown'>
                            <input type='image' src='/public/images/more-horizontal.png'>
                            <ul class='dropdown-menu dropdown-primary' role='menu' aria-labelledby='imageDropdown'>
                                <li class='menuitem edit-post-listing' style='display:none'><a role="button" class='editpost' data-toggle='modal' data-target='#editmodal${item.id}'>Edit</a></li>
                                <li class='menuitem delete-post-listing' style='display:none'><a role="button" class='deletepost'>Delete</a></li>
                            </ul>
                        </div>
                        <div class='modal fade' id='editmodal${item.id}' tabindex='-1' role='dialog' aria-labelledby='edittitle' aria-hidden='true'>
                            <div class='modal-dialog modal-dialog-centered'>
                                <div class='modal-content'>
                                    <div class='modal-header'>
                                        <h5 class="modal-title" id="edtittitle">Edit post</h5>
                                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                        <span aria-hidden="true">&times;</span>
                                        </button>
                                    </div>
                                    <div class='modal-body'>
                                        <form>
                                            <div class="form-group">
                                                <textarea class="form-control edit-post-content">${item.content}</textarea>
                                            </div>
                                        </form>
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                                        <button type="button" class="btn btn-primary edit-post-btn">Update Post</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class='post-content'>${item.content}</div>
                    <hr class="divider">
                    <div>
                        <form role="form" class="comment-form form-inline">
                            <div class="form-group" id="comment-input-container">
                                <textarea type="text" class="comment-area form-control rounded-1" rows="1" id="new-comment-content" placeholder="Write a comment..."></textarea>
                                <button type="submit" class="comment-btn btn btn-outline-primary btn-sm ml-2" id="submit-comment-btn">
                                    Comment
                                </button>
                            </div>
                        </form>
                    </div>
                    <div class='comment-feed'></div>
                    
                    <div class='post-id' style='display:none;'>${item.id}</div>
                    <div class='post-datetime' style='display:none;'>${item.datetime}</div>
                </div>
                `);
                if (user === item.author) {
                    itemElement.find('#post-author-link').html(`${item.author} <small>(you)</small>`);
                    itemElement.find('.edit-post-listing').show();
                    initEditPostButton(itemElement);
                    itemElement.find('.delete-post-listing').show();
                    initDeletePostButton(itemElement);
                } else {
                    itemElement.find('.dropdown').hide();
                }
                if (item.author === item.wallUser) {
                    itemElement.find('.wall-user-text').html('posted on their wall');
                }
                if (user === item.wallUser) {
                    itemElement.find('.wall-user-text').html('posted on your wall');
                }
                if (isOtherProfile) {
                    itemElement.find('#new-comment-content').attr("placeholder", "Write a comment (must be friends)");
                }
                initPostCommentForm(itemElement);
                fillPostCommentFeed(itemElement);
            } else if (item.contentType === "friendship") {
                itemElement =
                $(`
                <div class='post border border-primary'> 
                    <div class='row post-header'> <h3 class='post-author'> 
                        <a id="post-author-link" href='/user?username=${item.author}'>${item.author}</a></h3>
                        <div class='post-date'>${timePassed}</div>
                    </div>
                    <div class='post-content'>I became friends with <a href='/user?username=${item.content}'>${item.content}!</a></div>
                    <div class='post-id' style='display:none;'>${item.id}</div>
                    <div class='post-datetime' style='display:none;'>${item.datetime}</div>
                </div>
                `);
                if (user === item.author) {
                    itemElement.find('#post-author-link').html(`${item.author} <small>(you)</small>`);
                }
            } else if (item.contentType === "status") {
                itemElement =
                $(`
                <div class='post border border-primary'> 
                    <div class='row post-header'> <h3 class='post-author'> 
                        <a id="post-author-link" href='/user?username=${item.author}'>${item.author}</a> updated their status</h3>
                        <div class='post-date'>${timePassed}</div>
                    </div>
                    <div class='post-content'>${item.content}</div>
                    <div class='post-id' style='display:none;'>${item.id}</div>
                    <div class='post-datetime' style='display:none;'>${item.datetime}</div>
                </div>
                `);
                if (user === item.author) {
                    itemElement.find('#post-author-link').html(`${item.author} <small>(you)</small>`);
                }
            } else if (item.contentType === "news") {
                itemElement =
                $(`
                <div class='post news-rec border border-primary'> 
                    <div class='row post-header'> <h3 class='post-author'> 
                        <small class="wall-user-text text-muted">Recommended for you (based on your interests and likes)</small></h3>
                        <div class='post-date'></div>
                    </div>
                    <div class='post-content'>
                        <h5><a href=${item.newsLink}>${item.newsHeadline}</a></h5>
                        <div class="news-author"><small class="text-muted"><i>${item.newsAuthor}</i>, ${item.newsDate}</small></div>
                        <div class="news-description">${item.newsDescription}</div>
                    </div>
                    <div style="overflow:hidden"> 
                        <button class="btn btn-sm btn-outline-primary news-rec-like-btn float-right">Like (<span class="news-likes">${item.newsLikes}</span>)</button>
                        <button class="btn btn-sm btn-primary news-rec-unlike-btn float-right" style="display:none">Liked (<span class="news-likes">${item.newsLikes}</span>)</button>
                    </div>
                    <div class='post-id' style='display:none;'>${item.id}</div>
                    <div class='post-datetime' style='display:none;'>${item.datetime}</div>
                </div>
                `);
                if (item.liked === "true") {
                    itemElement.find('.news-rec-like-btn').hide();
                    itemElement.find('.news-rec-unlike-btn').show();
                }
                initLikeUnlikeRecPostButton(itemElement, item.id, item.content);
            }
            newPostsElement.append(itemElement);
        })
        if (newItems) {
            if (isAppend) {
                feedElement.append(newPostsElement);
            } else {
                feedElement.prepend(newPostsElement);
            }
        }
    });
}


function initLikeUnlikeRecPostButton(recPost, postId, link) {
    let likeButton = recPost.find('.news-rec-like-btn');
    let unlikeButton = recPost.find('.news-rec-unlike-btn');
    let newsLikes = recPost.find('.news-likes');
    likeButton.click(function() {
        $.ajax({
            url: '/api/posts/likeunlikenews',
            type: 'PATCH',
            data: {id: postId, link: link, liked: true},
            success: function(response) {
                if (response.success) {
                    let numLikes = parseInt(newsLikes.html()) + 1;
                    newsLikes.html(numLikes);
                    likeButton.hide();
                    unlikeButton.show();
                } else {
                    console.log(response);
                    alert("An error occurred while liking this news post");
                }
            }
        });
    });
    unlikeButton.click(function() {
        $.ajax({
            url: '/api/posts/likeunlikenews',
            type: 'PATCH',
            data: {id: postId, link: link, liked: false},
            success: function(response) {
                if (response.success) {
                    let numLikes = parseInt(newsLikes.html()) - 1;
                    newsLikes.html(numLikes);
                    unlikeButton.hide();
                    likeButton.show();
                } else {
                    console.log(response);
                    alert("An error occurred while unliking this news post");
                }
            }
        });
    });
}


function initEditPostButton(post) {
    let postId = post.find('.post-id').html();
    let editButton = post.find('.edit-post-btn');

    editButton.click(function() {
        let postContent = post.find('.edit-post-content').val();
        $.ajax({
            url: '/api/posts/update',
            type: 'PATCH',
            data: {id: postId, content: postContent},
            success: function(response) {
                if (response.success) {
                    alert("Message updated!");
                    location.reload();
                } else {
                    console.log(response);
                    alert("An error occurred while updating this post");
                }
            }
        });
    });
}


function initDeletePostButton(post) {
    let toDelete = post.find('.post-id').html();
    let deleteButton = post.find('.deletepost');

    // I removed datetime as part of the 'data', since it wasn't working with DynamoDB
    deleteButton.click(function() {
        let confirmRemove = confirm("Delete post?");
        if (confirmRemove) {
            $.ajax({
                url: '/api/posts/delete',
                type: 'DELETE',
                data: {id: toDelete},
                success: function(response) {
                    if (response.success) {
                        location.reload();
                    } else {
                        console.log(response);
                        alert("An error occurred while deleting this post");
                    }
                }
            });
        }
    });
}

function initPostCommentForm(post) {
    let commentForm = post.find('.comment-form');
    let postId = post.find('.post-id').html();

    commentForm.on('submit', function(e) {
        e.preventDefault();
        let commentContent = post.find('#new-comment-content');
        $.post('/api/comments/create', { 
            postId: postId,
            content: commentContent.val()
        },
        function(data) {
            if (data.success) {
                commentContent.val("");
                commentFeed = post.find('.comment-feed');
                if (commentFeed.find('.is-showing-more').length) {
                    prependPostCommentFeed(commentFeed);
                } else {
                    fillPostCommentFeed(commentFeed.parent());
                }
            } else {
                alert("You must be friends with this user to comment!");
            }
        }, 'json');
    });
}


function refreshPostComments(feedElement) {
    let commentFeeds = feedElement.find('.comment-feed');
    commentFeeds.each(function() {
        commentFeed = $(this);
        if (commentFeed.find('.is-showing-more').length) {
            prependPostCommentFeed(commentFeed);
        } else {
            fillPostCommentFeed(commentFeed.parent());
        }
    });
}


// Only called if user has hit "show older comments" or posted a comment while showing older comments
function prependPostCommentFeed(commentFeed) {
    let newItems = false;

    let mostRecentDate = commentFeed.find('.comment-datetime:first').html();

    let newCommentsElement = $("<div></div>");
    $.getJSON("/api/comments/get", {postId: commentFeed.parent().find('.post-id').html(), startDatetime: mostRecentDate, forward: true}, function(item) {
        if (item.success === true) {
            if (item.data.comments) {
                let comments = item.data.comments;
                let sorted = comments.sort((a, b) => (new Date(a.datetime).getTime() < new Date(b.datetime).getTime()) ? 1 : -1);
                sorted.forEach((comment) => {
                    if (!(commentFeed.find(".comment-datetime:contains('" + comment.datetime + "')").length)) {
                        newItems = true;
                        newCommentsElement.append(`
                            <div class='user-comment'>
                                <span class='user-comment-content'>
                                    <a href="/user?username=${comment.author}"><b class='friend-username'>${comment.author}:</b></a> ${comment.content}
                                </span>
                                <small class="comment-date text-muted ml-2">${moment(new Date(comment.datetime)).fromNow()}</small>
                                <div class='comment-datetime' style='display:none;'>${comment.datetime}</div>
                            </div>
                        `)
                    }
                })
                if (newItems) {
                    commentFeed.prepend(newCommentsElement);
                }
            }
        }
    })
}

function fillPostCommentFeed(post, startDatetime) {
    let commentFeed = post.find('.comment-feed')
    
    $.getJSON("/api/comments/get", {postId: post.find('.post-id').html(), startDatetime: startDatetime}, function(item) {
        if (item.success === true) {
            commentFeed.find('#show-more-btn').remove();
            if (item.data.comments) {
                // Initial load (also occurs on refresh when user is not showing older comments)
                if (!startDatetime) {
                    commentFeed.html("");
                }

                let comments = item.data.comments;
                let sorted = comments.sort((a, b) => (new Date(a.datetime).getTime() < new Date(b.datetime).getTime()) ? 1 : -1);
                sorted.forEach((comment) => {
                    commentFeed.append(`
                        <div class='user-comment'>
                            <span class='user-comment-content'>
                                <a href="/user?username=${comment.author}"><b class='friend-username'>${comment.author}:</b></a> ${comment.content}
                            </span>
                            <small class="comment-date text-muted ml-2">${moment(new Date(comment.datetime)).fromNow()}</small>
                            <div class='comment-datetime' style='display:none;'>${comment.datetime}</div>
                        </div>
                    `)
                })
                if (item.data.LastEvaluatedKey) {
                    let showMoreBtn = $(`
                    <div id='show-more-btn' role='button'>
                        <small class="comment-date text-muted ml-2">Show older comments...</small>
                    </div>
                    `)
                    showMoreBtn.click(function() {
                        fillPostCommentFeed(post, item.data.LastEvaluatedKey.datetime);
                        if (!(commentFeed.find('.is-showing-more').length)) {
                            commentFeed.append("<div class='is-showing-more'></div>");
                        }
                    });
                    commentFeed.append(showMoreBtn);
                }
            }
        }
    })

}