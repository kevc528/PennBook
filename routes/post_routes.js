const { validationResult } = require('express-validator');
var model = require('../models/post_model');
var userModel = require('../models/user_model');
var friendModel = require('../models/friend_model');

/**
 * Route function for having logged in user post on another user (or their own) wall
 * @param {*} req 
 * @param {*} res 
 */
var postOnWall = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'err': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'err': 'Need to be logged in'})
    } else {
        userModel.get_user_by_username(req.body.username, "id", function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else if (data.Items.length) {
                let userId = data.Items[0].id;
                let contentType = "post";
                if (req.body.contentType) {
                    contentType = req.body.contentType;
                }
                model.create_post(req.session.logged_in_id, userId, req.body.content, contentType, function(err, data) {
                    if (err) {
                        res.json({'success': false, 'error': err})
                    } else {
                        res.json({'success': true, 'data': data})
                    }
                })
            } else {
                res.json({'success': false, 'error': 'No such user'})
            }
        })
    }
}

/**
 * Route function for deleting a specific post
 * @param {*} req 
 * @param {*} res 
 */
var deleteUserPost = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'err': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'err': 'Need to be logged in'})
    } else {
        model.delete_post(req.body.id, req.session.logged_in_id, function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else {
                res.json({'success': true, 'data': data})
            }
        })
    }
}

/**
 * Route function for updating a specific post
 * @param {*} req 
 * @param {*} res 
 */
var updateUserPost = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'err': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'err': 'Need to be logged in'})
    } else {
        model.update_post(req.body.id, req.body.content, req.session.logged_in_id,
            function(err, data) {
                if (err) {
                    res.json({'success': false, 'error': err})
                } else {
                    res.json({'success': true, 'data': data})
                }
            }
        )
    }
}


/**
 * Route function for liking/unliking a specific post
 * @param {*} req 
 * @param {*} res 
 */
var likeOrUnlikeNewsPost = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'err': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'err': 'Need to be logged in'})
    } else {
        model.like_unlike_news_post(req.body.id, req.body.link, req.session.logged_in_id, req.body.liked,
            function(err, data) {
                if (err) {
                    res.json({'success': false, 'error': err})
                } else {
                    res.json({'success': true, 'data': data})
                }
            }
        )
    }
}


/**
 * Route function for getting a user's wall - uses startId and startDatetime for lazy loading purposes
 * @param {*} req 
 * @param {*} res 
 */
var getWall = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'err': errors.errors[0].param + ' is invalid'})
    } else {
        userModel.get_user_by_username(req.query.username, "id", function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else if (data.Items.length) {
                let userId = data.Items[0].id
                model.get_wall_posts(userId, req.session.logged_in_id, req.query.startId, req.query.startDatetime, req.query.forward, req.query.noLimit,
                    function(err, data) {
                        if (err) {
                            console.log("err (getWall):" + err);
                            res.json({'success': false, 'error': err})
                        } else {
                            res.json({'success': true, 'data': data})
                        }
                    }
                )
            } else {
                res.json({'success': false, 'error': 'No such user'})
            }
        })
    }    
}


/**
 * Route function for getting posts of all friends (including yourself)
 * @param {*} req username to get wall of friends of
 * @param {*} res 
 */
var getWallOfFriends = function(req, res) {
    let promises = [];
    let wallPromises = [];
    let friendUsernames;
    let friendIds = [];
    let allPosts = [];

   
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'err': errors.errors[0].param + ' is invalid'})
    } else {
        friendModel.get_all_friends(req.session.logged_in_id, function(err, data) {
            if (err) {
                console.log("err:" + err);
                res.json({'success': false, 'error': err})
            } else {
                friendUsernames = data;
                friendUsernames.forEach((username) => {
                    promises.push(new Promise((resolve, reject) => {
                        userModel.get_user_by_username(username, "id", function(err, result) {
                            if (err) {
                                console.log(err);
                            } else {
                                friendIds.push(result.Items[0].id)
                            }
                            resolve();
                        })
                    })) 
                })
                Promise.all(promises).then(() => {
                    friendIds.push(req.session.logged_in_id);
                    friendIds.forEach((userId) => {
                        wallPromises.push(new Promise((resolve, reject) => {
                            // Not the most efficient way, but still more scalable than sending everything to the front-end
                            model.get_wall_posts(userId, req.session.logged_in_id, req.query.startId, req.query.initialDateTime, req.query.forward, req.query.noLimit,
                                function(err, data) {
                                    if (err) {
                                        console.log("err: (getWallOfFriends)" + err);
                                    } else {
                                        if (data.posts) {
                                            allPosts = allPosts.concat(data.posts);
                                        }
                                    }
                                    resolve();
                                }
                            )
                        })) 
                    });
                    Promise.all(wallPromises).then(() => {
                        let numPerPage = 10;
                        let sortedItems = allPosts.sort((a, b) => (new Date(a.datetime).getTime() < new Date(b.datetime).getTime()) ? 1 : -1);
                        let page = req.query.page;
                        let lowest = numPerPage * (page - 1);
                        numPages = Math.ceil(sortedItems.length / numPerPage);
                        if (page > numPages) {
                            res.json({'success': false, 'err': "no more posts"});
                        } else {
                            if (sortedItems.length) {
                                res.json({'success': true, 'posts': sortedItems.slice(lowest, lowest + numPerPage)});
                            } else {
                                res.json({'success': false, 'err': "no more posts"});
                            }
                        }
                    })
                });
            }
        })
    }    
}


var post_routes = {
    post_on_wall: postOnWall,
    delete_user_post: deleteUserPost,
    update_user_post: updateUserPost,
    like_or_unlike_news_post: likeOrUnlikeNewsPost,
    get_wall: getWall,
    get_wall_of_friends: getWallOfFriends
}

module.exports = post_routes
