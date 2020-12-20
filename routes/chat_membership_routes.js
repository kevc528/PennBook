const { validationResult } = require('express-validator');
var model = require('../models/chat_membership_model');
const { CHAT_TYPES } = require('../models/chat_model');
const chat_model = require('../models/chat_model');
const { post_event, MESSAGE_CODES } = require('../models/message_model');
var user_model = require('../models/user_model')

/**
 * POST request function for creating a new chat invite
 * @param {*} req 
 * @param {*} res 
 */
var createChatInvite = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'error': 'Need to be logged'})
    } else {
        user_model.get_user_by_username(req.body.username, "id", function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else if (data.Items.length) {
                let userId = data.Items[0].id
                model.create_invite(req.body.chatId, userId, req.session.logged_in_id, function(err, data) {
                    if (err && err.message === "The conditional request failed") {
                        res.json({'success': false, 'err': "This user is already in the chat, or already invited to the chat."})
                    } else if (err) {
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

var joinExistingPrivate = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'error': 'Need to be logged'})
    } else {
        chat_model.get_chat(req.body.chatId, function(err, data) {
            console.log(req.session.logged_in_id)
            if (err) {
                res.status(400).json({'success': false, 'error': err}) 
            } else {
                if (data.Item.type !== CHAT_TYPES.private) {
                    res.status(400).json({'success': false, 'error': 'Not a private chat'})
                } else if (data.Item.userId1 === req.session.logged_in_id || data.Item.userId2 === req.session.logged_in_id) {
                    model.create_membership(req.body.chatId, req.session.logged_in_id, req.session.logged_in_id, true,
                        function(err, data) {
                            if (err) {
                                res.status(400).json({'success': false, 'error': err})  
                            } else {
                                post_event(req.body.chatId, MESSAGE_CODES.join, req.session.logged_in_id,
                                    function(err, data) {
                                        if (err) {
                                            res.json({'success': false, 'error': err, 'when': 'message'})
                                        } else {
                                            res.json({'success': true, 'data': data})
                                        }
                                    }
                                )
                            }
                        }
                    )
                } else {
                    res.status(400).json({'success': false, 'error': 'Not permitted to join'})
                }
            }
        })
    }
}

/**
 * GET for seing if a user is a member of a given chat
 * @param {*} req 
 * @param {*} res 
 */
var getChatMembership = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'error': 'Need to be logged in'})
    } else {
        model.get_membership(req.query.chatId, req.session.logged_in_id, function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else {
                res.json({'success': true, 'data': data})
            }
        })
    }
}

/**
 * GET handler to get all invites for a logged in user
 * @param {*} req 
 * @param {*} res 
 */
var getUserInvites = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'error': 'Need to be logged in'})
    } else {
        model.get_user_invites(req.session.logged_in_id, function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else {
                res.json({'success': true, 'data': data})
            }
        })
    }
}

/**
 * PATCH handler for accepting a chat invite
 * @param {*} req 
 * @param {*} res 
 */
var acceptChatInvite = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'error': 'Need to be logged in'})
    } else {
        model.accept_invite(req.body.chatId, req.session.logged_in_id, function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err, 'when': 'acceptance'})
            } else {
                post_event(req.body.chatId, MESSAGE_CODES.join, req.session.logged_in_id,
                    function(err, data) {
                        if (err) {
                            res.json({'success': false, 'error': err, 'when': 'message'})
                        } else {
                            res.json({'success': true, 'data': data})
                        }
                    }
                )
            }
        })
    }
}

/**
 * DELETE handler for deleting a chat membership - used with rejecting invites and leaving chats
 * @param {*} req 
 * @param {*} res 
 */
var deleteChatMembership = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'error': 'Need to be logged in'})
    } else {
        model.get_membership(req.body.chatId, req.session.logged_in_id, function(err, membershipData) {
            if (membershipData === 'No membership') {
                res.json({'success': false, 'error': 'No membership'})
            } else {
                model.delete_membership(req.body.chatId, req.session.logged_in_id, function(err, data) {
                    if (err) {
                        res.json({'success': false, 'error': err, 'when': 'deletion'})
                    } else {
                        post_event(req.body.chatId, membershipData === 'Invited' ? MESSAGE_CODES.decline : MESSAGE_CODES.leave, req.session.logged_in_id,
                            function(err, data) {
                                if (err) {
                                    res.json({'success': false, 'error': err, 'when': 'message'})
                                } else {
                                    res.json({'success': true, 'data': data})
                                }
                            }
                        )
                    }
                })
            }
        })
    }
}

/**
 * GET route for getting all chats a user is part of
 * @param {*} req 
 * @param {*} res 
 */
var getUserChats = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'error': 'Need to be logged in'})
    } else {
        model.get_chat_memberships(req.session.logged_in_id, function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else {
                res.json({'success': true, 'data': data})
            }
        })
    }
}

var chat_membership_routes = {
    get_membership: getChatMembership,
    create_invite: createChatInvite,
    accept_chat_invite: acceptChatInvite,
    delete_membership: deleteChatMembership,
    get_user_chats: getUserChats,
    get_user_invites: getUserInvites,
    join_private_chat: joinExistingPrivate
}

module.exports = chat_membership_routes