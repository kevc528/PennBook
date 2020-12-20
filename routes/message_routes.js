const { validationResult } = require('express-validator');
const { get_membership } = require('../models/chat_membership_model');
var model = require('../models/message_model');

/**
 * POST handler - will take the logged in id and given chat id, to post the content in the body
 * @param {*} req 
 * @param {*} res 
 */
var createMessage = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'error': 'Need to be logged'})
    } else {
        get_membership(req.body.chatId, req.session.logged_in_id, function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else if (data === 'Member') {
                model.post_message(req.body.chatId, req.session.logged_in_id, req.body.content, function(err, data) {
                    if (err) {
                        res.json({'success': false, 'error': err})
                    } else {
                        res.json({'success': true, 'data': data})
                    }
                })
            } else {
                res.json({'success': false, 'error': 'Author not in chat'})
            }
        }) 
    }
}

var getMessagesInChat = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'error': 'Need to be logged'})
    } else {
        get_membership(req.query.chatId, req.session.logged_in_id, function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else if (data === 'Member') {
                model.get_chat_messages(req.query.chatId, req.query.startDatetime, req.session.logged_in_id,
                    function(err, data) {
                        if (err) {
                            res.json({'success': false, 'error': err})
                        } else {
                            res.json({'success': true, 'data': data})
                        }
                    }
                )
            } else {
                res.json({'success': false, 'error': 'Author not in chat'})
            }
        }) 
    }
} 

var message_routes = {
    send_message: createMessage,
    get_messages_in_chat: getMessagesInChat
}

module.exports = message_routes