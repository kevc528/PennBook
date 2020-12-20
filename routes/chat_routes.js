const { validationResult } = require('express-validator');
var async = require("async");
var model = require('../models/chat_model');
var membership_model = require('../models/chat_membership_model');
var user_model = require('../models/user_model')
const { post_event, MESSAGE_CODES } = require('../models/message_model');
const { CHAT_TYPES } = require('../models/chat_model');
const friend_model = require('../models/friend_model');
const { get_username_by_id } = require('../models/user_model');

/**
 * POST request function for creating a new chat - note that in data, the chat id will be returned 
 * As a side effect, the logged in user that creates the chat will also be added as a member
 * @param {*} req 
 * @param {*} res 
 */
var createChat = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({'success': false, 'err': errors.errors[0].msg});
    } else if (!req.session.logged_in_id) {
        // even though user id isn't needed, it's probably best to prevent anyone without an account from using this
        res.status(400).json({'success': false, 'error': 'Need to be logged in'})
    } else {
        req.body.type = parseInt(req.body.type)
        if (req.body.type === CHAT_TYPES.private && req.body.users.length !== 1) {
            res.json({'success': false, 'error': 'Private chats can only have two users'})
        } else if (req.body.type === CHAT_TYPES.private) {
            handlePrivateCreation(req, res)
        } else if (req.body.type === CHAT_TYPES.group) {
            handleGroupCreation(req, res)
        } else {
            res.json({'success': false, 'error': 'Invalid chat type'})
        }
    }
}

var handlePrivateCreation = function(req, res) {
    let otherUsername = req.body.users[0]
    user_model.get_user_by_username(otherUsername, "id", function(err, data) {
        if (err) {
            res.json({'success': false, 'error': err})
        } else if (data.Items.length) {
            let userId = data.Items[0].id
            // check that the user is friends
            friend_model.get_friendship(userId, req.session.logged_in_id, function(err, friendData) {
                if (err) {
                    res.json({'success': false, 'error': err})
                } else if (friendData && friendData.Items[0].accepted) {
                    // create a private chat
                    model.create_private_chat(req.session.logged_in_id, userId, function(err, chatData) {
                        if (err) {
                            res.json({'success': false, 'error': err})
                        } else {
                            membership_model.create_membership(chatData.chatId, req.session.logged_in_id, req.session.logged_in_id, true,
                                function(err, data) {
                                    if (err) {
                                        callback(err, null)
                                    } else {
                                        post_event(chatData.chatId, MESSAGE_CODES.join, req.session.logged_in_id, function(err, data) {
                                            if (err) {
                                                callback(err, null)
                                            } else {
                                                membership_model.create_membership(chatData.chatId, userId, req.session.logged_in_id, false,
                                                    function(err, data) {
                                                        if (err) {
                                                            res.json({'success': false, 'error': err})
                                                        } else {
                                                            res.json({'success': true, 'data': chatData})
                                                        }
                                                    }
                                                )
                                            }
                                        })
                                    }
                                }
                            )
                        }
                    })
                } else {
                    res.json({'success': false, 'error': 'Not friends'})
                }
            })                 
        } else {
            res.json({'success': false, 'error': 'No such user'})
        }
    })
}

var handleGroupCreation = function(req, res) {
    model.create_group_chat(req.body.name, function(err, chatData) {
        if (err) {
            res.json({'success': false, 'error': err})
        } else {
            initializeChatMemberships(chatData, req.body.users, req.session.logged_in_id,
                function(err, data) {
                    if (err) {
                        res.json({'success': false, 'error': err})
                    } else {
                        res.json({'success': true, 'data': data})
                    }
                }
            )
        }
    })
}

var initializeChatMemberships = function(chatData, users, logged_in_id, callback) {
    membership_model.create_membership(chatData.chatId, logged_in_id, logged_in_id, true,
        function(err, data) {
            if (err) {
                callback(err, null)
            } else {
                post_event(chatData.chatId, MESSAGE_CODES.join, logged_in_id, function(err, data) {
                    if (err) {
                        callback(err, null)
                    } else {
                        sendInvites(chatData.chatId, users, logged_in_id, function(err, data) {
                            if (err) {
                                callback(err, null)
                            } else {
                                callback(err, chatData)
                            }
                        })
                    }
                })
            }
        }
    )
}

var sendInvites = function(chatId, usernames, inviterId, callback) {
    async.each(usernames, function(username, cb) {
        user_model.get_user_by_username(username, "id", function(err, userData) {
            if (err) {
                cb(err)
            } else if (userData.Items.length) {
                let userId = userData.Items[0].id
                friend_model.get_friendship(userId, inviterId, function(err, friendData) {
                    if (err) {
                        cb(err)
                    } else if (friendData && friendData.Items[0].accepted) {
                        membership_model.create_membership(chatId, userId, inviterId, false, function(err, data) {
                            if (err) {
                                cb(err)
                            } else {
                                cb()
                            }
                        })
                    } else {
                        cb('Not friends')
                    }
                })
            } else {
                cb('No such user')
            }
        })
    }, function(err) {
        if (err) {
            callback(err, null)
        } else {
            callback(err, null)
        }
    })
}

var getPrivateChat = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        // even though user id isn't needed, it's probably best to prevent anyone without an account from using this
        res.status(400).json({'success': false, 'error': 'Need to be logged in'})
    } else {
        user_model.get_user_by_username(req.query.username, "id", function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else if (data.Items.length) {
                let userId = data.Items[0].id
                model.get_private_chat(req.session.logged_in_id, userId, function(err, chatData) {
                    if (err) {
                        res.json({'success': false, 'error': err})
                    } else if (chatData && chatData.Items.length) {
                        membership_model.get_members_in_chat(chatData.Items[0].id, function(err, memberData) {
                            if (err) {
                                res.json({'success': false, 'error': err})
                            } else {
                                let transformedData = memberData.Items.map(x => {
                                    if (x.userId === req.session.logged_in_id) {
                                        return {'username': req.session.logged_in_user, 'accepted': x.accepted}
                                    } else {
                                        return {'username': req.query.username, 'accepted': x.accepted}
                                    }
                                })
                                res.json({'success': true, 'chatId': chatData.Items[0].id, 'members': transformedData})
                            }
                        })
                    } else {
                        res.json({'success': true, 'data': null})
                    }
                })
            } else {
                res.json({'success': false, 'error': 'No such user'})
            }
        })
    }
}

var getChat = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        // even though user id isn't needed, it's probably best to prevent anyone without an account from using this
        res.status(400).json({'success': false, 'error': 'Need to be logged in'})
    } else {
        membership_model.get_membership(req.query.chatId, req.session.logged_in_id, function(err, data) {
            if (err) {
                res.json({'success': false, 'error': 'Error getting chat membership'})
            } else if (data === 'Member') {
                // can only get chat info if member
                model.get_chat(req.query.chatId, function(err, data) {
                    if (err) {
                        res.json({'success': false, 'error': 'Error getting chat'})
                    } else {
                        membership_model.get_members_in_chat(req.query.chatId, function(err, memberData) {
                            if (err) {
                                res.json({'success': false, 'error': err})
                            } else {
                                let members = memberData.Items
                                if (members.length === 1 && data.Item.type === CHAT_TYPES.private) {
                                    let otherUser = req.session.logged_in_id == data.Item['userId1'] ? data.Item['userId2'] : data.Item['userId1']

                                    if ('userId1' in data.Item)
                                        delete data.Item['userId1']
                                    if ('userId2' in data.Item)
                                        delete data.Item['userId2']
                                    
                                    get_username_by_id(otherUser, function(err, username) {
                                        if (err) {
                                            res.json({'success': false, 'error': err})
                                        } else {
                                            data.Item.members = [
                                                {'username': req.session.logged_in_user, 'accepted': true},
                                                {'username': username, 'accepted': false, 'denied': true}
                                            ]
                                            res.json({'success': true, 'data': data.Item})
                                        }
                                    })
                                } else {
                                    async.eachOf(members, function(member, idx, cb) {
                                        get_username_by_id(member.userId, function(err, username) {
                                            if (err) {
                                                cb(err)
                                            } else {
                                                let memberObj = members[idx]
                                                delete memberObj['userId']
                                                memberObj['username'] = username
                                                cb()
                                            }
                                        })
                                    }, function(err) {
                                        if (err) {
                                            callback(err)
                                        } else {
                                            data.Item.members = members
                                            res.json({'success': true, 'data': data.Item})
                                        }
                                    })
                                }
                            }
                        })
                    }
                })
            } else {
                res.json({'success': false, 'error': 'User is not a member of the chat'})
            }
        })
    }
}

var chat_routes = {
    create_chat: createChat,
    get_private_chat: getPrivateChat,
    get_chat: getChat
}

module.exports = chat_routes;
