const { validationResult } = require('express-validator');
var model = require('../models/comment_model');

/**
 * Route function for posting a comment to a post
 * @param {*} req 
 * @param {*} res 
 */
var postComment = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'error': 'Need to be logged in'})
    } else {
        model.create_comment(req.body.postId, req.session.logged_in_id, req.body.content, function(err, data) {
            if (err) {
                res.json({'success': false, 'error': err})
            } else {
                res.json({'success': true, 'data': data})
            }
        })
    }
}

/**
 * Route function for getting comments for a post (with lazy loading)
 * @param {*} req 
 * @param {*} res 
 */
var getComments = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({'success': false, 'error': errors.errors[0].param + ' is invalid'})
    } else if (!req.session.logged_in_id) {
        res.status(400).json({'success': false, 'error': 'Need to be logged in'})
    } else {
        model.get_comments(req.query.postId, req.query.startDatetime, req.session.logged_in_id, req.query.forward,
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

var comment_route = {
    post_comment: postComment,
    get_comments: getComments,
}

module.exports = comment_route;
