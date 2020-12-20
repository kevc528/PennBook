const { validationResult } = require('express-validator');
var model = require('../models/friend_model');
var userModel = require('../models/user_model');
var postModel = require('../models/post_model');
var app = require('../app.js');

/**
 * Route function for looking at friend status 
 * @param {*} req 
 * @param {*} res 
 */
var getFriendStatus = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else {
        userModel.get_user_by_username(req.query.username, "id", function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else if (data.Items.length) {
                let userId = data.Items[0].id
                model.get_friendship(req.session.logged_in_id, userId, function(err, data) {
                    if (err) {
                        res.json({'success': false, 'error': err})
                    } else if (data && data.Items.length) {
                        let relation = data.Items[0]
                        if (relation.accepted) {
                            res.json({'success': true, 'status': 'Friends'})
                        } else if (relation.id1 === req.session.logged_in_id) {
                            res.json({'success': true, 'status': 'Request sent'})
                        } else {
                            res.json({'success': true, 'status': 'Request received'})
                        }    
                    } else {
                        res.json({'success': true, 'status': 'Not friends'})
                    }
                })
            } else {
                res.json({'success': false, 'error': 'No such user'})
            }
        }) 
    }
}

/**
 * Route function for creating a friend request using currently logged in user
 * @param {*} req 
 * @param {*} res 
 */
var createFriendRequest = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else {
        if (req.body.username === req.session.logged_in_user) {
            res.json({'success': false, 'error': 'You cannot add yourself as a friend!'})
        } else {
            userModel.get_user_by_username(req.body.username, "id", function(err, data) {
                if (err) {
                    res.json({'success': false, 'error': err})
                } else if (data.Items.length) {
                    let userId = data.Items[0].id
                    model.create_friend_request(req.session.logged_in_id, userId, function(err, data) {
                        if (err) {
                            res.json({'success': false, 'error': err})
                        } else {
                            res.json({'success': true, 'data': data})
                        }
                    })
                } else {
                    res.json({'success': false, 'error': 'We could not find a user with the provided username.'})
                }
            })
        }
    }
}

/**
 * Route function fro accepting a friend request
 * @param {*} req 
 * @param {*} res 
 */
var acceptRequest = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else {
        userModel.get_user_by_username(req.body.username, "id", function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else if (data.Items.length) {
                let userId = data.Items[0].id
                model.accept_friend_request(userId, req.session.logged_in_id, function(err, data) {
                    if (err) {
                        res.json({'success': false, 'error': err})
                    } else {
                        // Make posts on both users' walls that they became friends
                        postModel.create_post(req.session.logged_in_id, req.session.logged_in_id, req.body.username, "friendship", function(err, data) {
                            if (err) {
                                res.json({'success': false, 'error': err})
                            } else {
                                postModel.create_post(userId, userId, req.session.logged_in_user, "friendship", function(err, data) {
                                    if (err) {
                                        res.json({'success': false, 'error': err})
                                    } else {
                                        res.json({'success': true, 'data': data})
                                    }
                                })
                            }
                        })
                    }
                })
            } else {
                res.json({'success': false, 'error': 'No such user'})
            }
        })
    }
}

/**
 * Route function for deleting a friendship or request
 * @param {*} req 
 * @param {*} res 
 */
var deleteFriendship = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else {
        userModel.get_user_by_username(req.body.username, "id", function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else if (data.Items.length) {
                let userId = data.Items[0].id
                model.delete_friendship(req.session.logged_in_id, userId, function(err, data) {
                    if (err) {
                        res.json({'success': false, 'error': err})
                    } else {
                        res.json({'success': true})
                    }
                })
            } else {
                res.json({'success': false, 'error': 'No such user'})
            }
        })
    }
}

/**
 * Route for getting friends of a user
 * @param {*} req 
 * @param {*} res 
 */
var getFriends = function(req, res) {
    userModel.get_user_by_username(req.query.username, "id", function(err, data) {
        if (err) {
            res.json({'success': false, 'error': err})
        } else if (data.Items.length) {
            let userId = data.Items[0].id
            model.get_all_friends(userId, function(err, data) {
                let allOnlineUsers = app.getOnlineUsers();
                let offlineFriends = [];
                let onlineFriends = [];
                
                if(data) {
                data.forEach((friend) => {
                    if (allOnlineUsers.includes(friend)) {
                        onlineFriends.push(friend);
                    } else {
                        offlineFriends.push(friend);
                    }
                }); }
                
                if (err) {
                    res.json({'success': false, 'error': err});
                } else {
                    res.json({'success': true, 'data': { 'online': onlineFriends, 'offline': offlineFriends }});
                }
            })
        } else {
            res.json({'success': false, 'error': 'No such user'})
        }
    })
}

/**
 * Route for getting friend requests directed at a user
 * @param {*} req 
 * @param {*} res 
 */
var getFriendRequests = function(req, res) {
    userModel.get_user_by_username(req.query.username, "id", function(err, data) {
        if (err) {
            res.json({'success': false, 'error': err})
        } else if (data.Items.length) {
            let userId = data.Items[0].id
            model.get_friend_requests(userId, function(err, data) {
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

var friend_routes = {
    send_friend_request: createFriendRequest,
    get_friend_status: getFriendStatus,
    accept_request: acceptRequest,
    delete_friend: deleteFriendship,
    get_friends: getFriends,
    get_friend_requests: getFriendRequests
}

module.exports = friend_routes
