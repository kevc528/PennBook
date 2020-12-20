var db = require('../models/database.js');
var uuid = require('uuid');
var async = require("async");

var friendModel = require('./friend_model')
var userModel = require('./user_model')
var newsModel = require('./news_model')

const TABLE_NAME = 'posts';
const WALL_INDEX = 'wallId-index'

const NEWS_TABLE_NAME = 'news-recommendations'
const NEWS_INFO_TABLE_NAME = 'news-recommendations-info'

/**
 * Create a post writen by authorId on the wall of user with wallId
 * @param {*} authorId 
 * @param {*} wallId 
 * @param {*} content 
 * @param {*} callback 
 */
var createPost = function(authorId, wallId, content, contentType, callback) {
    friendModel.get_friendship(authorId, wallId, function(err, friendData) {
        if (err) {
            callback(err, null)
        } else {
            if (authorId === wallId || (friendData && friendData.Items[0].accepted)) {
                let id = uuid.v4();
                let params = {
                    'TableName': TABLE_NAME,
                    'Item': {
                        'id': id,
                        'authorId': authorId,
                        'wallId': wallId,
                        'content': content,
                        'contentType': contentType,
                        'datetime': new Date().toISOString()
                    },
                    'ConditionExpression': "attribute_not_exists(id)"
                }
                db.dynamoDB_put(params, callback)
            } else {
                callback('Not friends', null)
            }
        }
    })
}

/**
 * Checks if a user can view a post - useful for comments
 * @param {*} postId 
 * @param {*} userId 
 */
var canViewPost = function(postId, userId, callback) {
    let params = {
        "TableName": TABLE_NAME,
        "Key": {
            "id": postId
        },
        "ProjectionExpression": "wallId"
    }
    db.dynamoDB_get(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else if (data.Item) {
            let wallId = data.Item.wallId
            if (userId == wallId) {
                callback(null, true);
            } else {
                friendModel.get_friendship(wallId, userId, function(err, friendData) {
                    if (err) {
                        callback(err, null)
                    } else if (friendData && friendData.Items[0].accepted) {
                        callback(err, true)
                    } else {
                        callback(err, false)
                    }
                })
            }
        } else {
            callback("Post does not exist", null)
        }
    })
}

/**
 * Delete a post on a wall
 * @param {*} postId 
 * @param {*} senderId
 * @param {*} callback 
 */
var deletePost = function(postId, userId, callback) {
    let params = {
        'TableName': TABLE_NAME,
        'Key': {
            "id": postId,
        },
        'ExpressionAttributeValues': {
            ':userId': userId
        },
        'ConditionExpression': 'authorId = :userId or wallId = :userId'
    }
    db.dynamoDB_delete(params, function(err, data) {
        if (err && err.code === 'ConditionalCheckFailedException') {
            callback("No such post for user or no permission", null)
        } else if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

/**
 * Update a specific post in dynamodb
 * @param {*} postId 
 * @param {*} content 
 * @param {*} userId id of the current user logged in
 * @param {*} callback 
 */
var updatePost = function(postId, content, userId, callback) {
    let params = {
        'TableName': TABLE_NAME,
        'Key': {
            "id": postId
        },
        'ConditionExpression': 'authorId = :userId',
        'UpdateExpression': 'set content=:c, lastUpdated=:dt',
        "ExpressionAttributeValues": {
            ':userId': userId,
            ":c": content,
            ":dt": new Date().toISOString()
        }
    }
    db.dynamoDB_update(params, function(err, data) {
        if (err && err.code === 'ConditionalCheckFailedException') {
            callback("No such post for user", null)
        } else if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

/**
 * Like/unlike a post and a news recommendation in DynamoDB
 * @param {*} postId 
 * @param {*} content 
 * @param {*} userId id of the current user logged in
 * @param {*} callback 
 */
var likeUnlikeNewsPost = function(postId, link, userId, liked, callback) {
    let params = {
        'TableName': TABLE_NAME,
        'Key': {
            "id": postId
        },
        'ConditionExpression': 'authorId = :userId',
        'UpdateExpression': 'set liked=:l',
        "ExpressionAttributeValues": {
            ':userId': userId,
            ":l": liked,
        }
    }
    let paramsNews = {
        'TableName': NEWS_TABLE_NAME,
        'Key': {
            "userId": userId,
            "link": link
        },
        'UpdateExpression': 'set liked=:l',
        "ExpressionAttributeValues": {
            ":l": liked,
        }
    }
    let paramsNewsInfo;
    if (liked === "true") {
        paramsNewsInfo = {
            'TableName': NEWS_INFO_TABLE_NAME,
            'Key': {
                "link": link
            },
            'UpdateExpression': "add likes :inc",
            'ExpressionAttributeValues': {
                ':inc': 1
            },
        }
    } else {
        paramsNewsInfo = {
            'TableName': NEWS_INFO_TABLE_NAME,
            'Key': {
                "link": link
            },
            'UpdateExpression': "add likes :inc",
            'ExpressionAttributeValues': {
                ':inc': -1
            },
        }
    }
    
    db.dynamoDB_update(params, function(err, data) {
        if (err && err.code === 'ConditionalCheckFailedException') {
            callback("No such news for user", null)
        } else if (err) {
            callback(err, null)
        } else {
            db.dynamoDB_update(paramsNews, function(err, data2) {
                if (err && err.code === 'ConditionalCheckFailedException') {
                    callback("No such news for user", null)
                } else if (err) {
                    callback(err, null)
                } else {
                    db.dynamoDB_update(paramsNewsInfo, function(err, data3) {
                        if (err && err.code === 'ConditionalCheckFailedException') {
                            callback("No such news", null)
                        } else if (err) {
                            callback(err, null)
                        } else {
                            callback(err, data3);
                        }
                    })
                }
            })
        }
    })
}

/**
 * Get all the posts from a given wall ID in chronological - use lastEvaluatedKey for lazy loading.
 * @param {*} wallId id of user who has the wall that the current user is trying to view
 * @param {*} userId logged in user
 * @param {*} startKey exactly the same as the LastEvaluatedKey returned
 * @param {*} forward only pass in when getting posts newer than startDatetime (do not include otherwise)
 * @param {*} callback 
 */
var getPostsForWall = function(wallId, userId, startId, startDateTime, forward, noLimit, callback) {
    let startKey;
    // create exclusive start key if needed
    if (startId && startDateTime) {
        startKey = {
            "id": startId,
            "datetime": startDateTime,
            'wallId': wallId
        }
    }
    let params = {
        "TableName": TABLE_NAME,
        "IndexName": WALL_INDEX,
        "KeyConditionExpression": "wallId = :v_wallId",
        "FilterExpression": "authorId = :v_userId OR contentType <> :v_newsType",
        "ExpressionAttributeValues": {
            ":v_wallId": wallId,
            ":v_userId": userId,
            ":v_newsType": "news",
        },
        
        "ScanIndexForward": false
    }
    if (forward) {
        params["ScanIndexForward"] = true
    }
    if (!noLimit) {
        params["Limit"] = 5
    }
    if (startKey) {
        params["ExclusiveStartKey"] = startKey
    }
    db.dynamoDB_query(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else if (data.Items.length) {
            let usersInOrder = data.Items.map(x => x.authorId)
            let wallUsersInOrder = data.Items.map(x => x.wallId)
            let contentInOrder = data.Items.map(x => x.content)
            let transformedData = data.Items.map(x => (
                {
                    'id': x.id,
                    'content': x.content,
                    'contentType': x.contentType,
                    'datetime': x.datetime,
                    'liked': x.liked
                }
            ))

            // create the last evaluated key w/o leaking user id's
            let lastEvaluatedKey = data.LastEvaluatedKey;
            if (lastEvaluatedKey)
                delete lastEvaluatedKey['wallId']; 

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
                    async.eachOf(wallUsersInOrder, function(userId, idx, cb) {
                        userModel.get_username_by_id(userId, function(err, wallUser) {
                            if (err) {
                                cb(err)
                            } else {
                                transformedData[idx]['wallUser'] = wallUser
                                cb()
                            }
                        })
                    }, function(err) {
                        if (err) {
                            callback(err, null)
                        } else {
                            async.eachOf(contentInOrder, function(link, idx, cb) {
                                if (transformedData[idx]['contentType'] === "news") {
                                    newsModel.get_news_by_link(link, function(err, news) {
                                        if (err) {
                                            cb(err)
                                        } else {
                                            let category;
                                            if (news.category) {
                                                category = news.category.toLowerCase();
                                                category = category.charAt(0).toUpperCase() + category.slice(1);
                                            }
                                            transformedData[idx]['newsLink'] = link;
                                            transformedData[idx]['newsDate'] = news.date;
                                            transformedData[idx]['newsLikes'] = news.likes;
                                            transformedData[idx]['newsCategory'] = category;
                                            transformedData[idx]['newsHeadline'] = news.headline;
                                            transformedData[idx]['newsAuthor'] = news.author;
                                            transformedData[idx]['newsDescription'] = news.description;
                                            cb()
                                        }
                                    })
                                } else {
                                    cb()
                                }
                            }, function(err) {
                                if (err) {
                                    callback(err, null)
                                } else {
                                    let resData = {
                                        'posts': transformedData,
                                        'LastEvaluatedKey': lastEvaluatedKey
                                    }
                                    callback(err, resData)
                                }
                            })
                        }
                    })
                }
            })
        } else {
            callback(err, data.Items)
        }
    })
}


var post_model = {
    create_post: createPost,
    delete_post: deletePost,
    update_post: updatePost,
    get_wall_posts: getPostsForWall,
    can_view_post: canViewPost,
    like_unlike_news_post: likeUnlikeNewsPost
}

module.exports = post_model;
