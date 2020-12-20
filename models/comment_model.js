var db = require('./database')
var postModel = require('./post_model')
var async = require("async")
var userModel = require('./user_model')

const TABLE_NAME = 'comments'

/**
 * Creates a comment for a post
 * @param {*} postId 
 * @param {*} userId 
 */
var createComment = function(postId, userId, content, callback) {
    postModel.can_view_post(postId, userId, function(err, permission) {
        if (err) {
            callback(err, null)
        } else if (permission) {
            let params = {
                'TableName': TABLE_NAME,
                'Item': {
                    'postId': postId,
                    'authorId': userId,
                    'content': content,
                    'datetime': new Date().toISOString()
                }
            }
            db.dynamoDB_put(params, callback)
        } else {
            callback("No permission", null)
        }
    })
}

/**
 * Gets comments for a specific post (enables lazy-loading, initially gets LIMIT comments)
 * @param {*} postId required
 * @param {*} startDatetime used for loading older comments
 * @param {*} userId required - logged in user id
 * @param {*} forward only pass in when getting comments newer than startDatetime (do not include otherwise)
 */
var getComments = function(postId, startDatetime, userId, forward, callback) {
    let startKey;
    // create exclusive start key if needed
    if (startDatetime) {
        startKey = {
            "postId": postId,
            "datetime": startDatetime
        }
    }

    postModel.can_view_post(postId, userId, function(err, permission) {
        if (err) {
            callback(err, null)
        } else if (permission) {
            // ensure friendship
            let params;
            if (forward) {
                params = {
                    "TableName": TABLE_NAME,
                    "KeyConditionExpression": "postId = :v_postId",
                    "ExpressionAttributeValues": {
                        ":v_postId": postId,
                    },
                    "ScanIndexForward": true,
                }
            } else {
                params = {
                    "TableName": TABLE_NAME,
                    "KeyConditionExpression": "postId = :v_postId",
                    "ExpressionAttributeValues": {
                        ":v_postId": postId,
                    },
                    "Limit": 4,
                    "ScanIndexForward": false,
                }
            }
            if (startKey) {
                params["ExclusiveStartKey"] = startKey
            }
            db.dynamoDB_query(params, function(err, data) {
                if (err) {
                    callback(err, null)
                } else if (data.Items.length) {
                    let usersInOrder = data.Items.map(x => x.authorId)
                    let transformedData = data.Items.map(x => (
                        {
                            'content': x.content,
                            'datetime': x.datetime,
                        }
                    ))

                    // create the last evaluated key w/o leaking user id's
                    let lastEvaluatedKey = data.LastEvaluatedKey;
                    if (lastEvaluatedKey) {
                        delete lastEvaluatedKey['content']; 
                        delete lastEvaluatedKey['authorId']
                    }

                    // need to convert the userIds to usernames
                    async.eachOf(usersInOrder, function(userId, idx, cb) {
                        userModel.get_username_by_id(userId, function(err, data) {
                            if (err) {
                                cb(err)
                            } else {
                                transformedData[idx]['author'] = data
                                cb()
                            }
                        })
                    }, function(err) {
                        if (err) {
                            callback(err, null)
                        } else {
                            let resData = {
                                'comments': transformedData,
                                'LastEvaluatedKey': lastEvaluatedKey
                            }
                            callback(err, resData)
                        }
                    })
                } else {
                    callback(err, data.Items)
                }
            })
        } else {
            callback('No permission', null)
        }
    })
}


var comment_model = {
    create_comment: createComment,
    get_comments: getComments,
}

module.exports = comment_model;
