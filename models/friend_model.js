var db = require('../models/database.js');
var async = require("async");
const user_model = require('./user_model.js');

const TABLE_NAME = 'friends';
const ID_INDEX = 'id2-index';
const ID1_INDEX_SORTED = 'id1-index-sorted';
const ID2_INDEX_SORTED = 'id2-index-sorted';

/**
 * Gets friendship between two given users
 * @param {*} id1 the id of one user
 * @param {*} id2 the id of the other user
 * @param {*} callback 
 */
var getFriendship = function(id1, id2, callback) {
    let params1 = {
        "TableName": TABLE_NAME,
        "KeyConditionExpression": "id1 = :v_id1 and id2 = :v_id2",
        "ExpressionAttributeValues": {
            ":v_id1": id1,
            ":v_id2": id2
        }
    }
    let params2 = {
        "TableName": TABLE_NAME,
        "KeyConditionExpression": "id1 = :v_id2 and id2 = :v_id1",
        "ExpressionAttributeValues": {
            ":v_id1": id1,
            ":v_id2": id2
        }
    }

    params = [params1, params2]
    friendship = [];
    async.each(params, function(param, cb) {
        db.dynamoDB_query(param, function(err, data) {
            if (err) {
                cb(err)
            } else if (data.Count > 0) {
                friendship.push(data)
                cb()
            } else {
                cb()
            }
        })
    }, function(err) {
        if (err) {
            callback(err, null)
        } else if (friendship.length) {
            callback(err, friendship[0])
        } else {
            // return no error and null friendship for DNE
            callback(err, null)
        }
    })
}

/**
 * Create a friend request
 * @param {*} id1 this is the person who sends the request
 * @param {*} id2 this is the person who will receive the request
 * @param {*} callback
 */
var createFriendRequest = function(id1, id2, callback) {
    let params = {
        'TableName': TABLE_NAME,
        'Item': {
            'id1': id1,
            'id2': id2,
            'accepted': false
        }
    }
    getFriendship(id1, id2, function(err, data) {
        if (err) {
            callback(err, null)
        } else if (data && data.Items.length) {
            let relation = data.Items[0]
            if (relation.accepted) {
                callback('You are already friends with this user!', null)
            } else if (relation.id1 === id1) {
                callback('You have already sent a friend request to this user.', null)
            } else {
                callback('This user has already requested to add you as a friend.', null)
            }
        } else {
            db.dynamoDB_put(params, callback)
        }
    })
    
}

/**
 * Get's a list of friends by id given a specific user's id
 * @param {*} id id of the user
 * @param {*} callback 
 */
var getAllFriends = function(id, callback) {
    let params1= {
        "TableName": TABLE_NAME,
        "KeyConditionExpression": "id1 = :v_id",
        "FilterExpression": "accepted = :v_true",
        "ExpressionAttributeValues": {
            ":v_id": id,
            ":v_true": true
        },
    }
    let params2= {
        "TableName": TABLE_NAME,
        "IndexName": ID_INDEX,
        "KeyConditionExpression": "id2 = :v_id",
        "FilterExpression": "accepted = :v_true",
        "ExpressionAttributeValues": {
            ":v_id": id,
            ":v_true": true
        },
    }

    let params = [params1, params2]
    let friends = []
    let friendUsernames = []
    async.each(params, function(param, cb) {
        db.dynamoDB_query(param, function(err, data) {
            if (err) {
                cb(err)
            } else {
                friends = friends.concat(data.Items)
                cb()
            }
        })
    }, function(err) {
        if (err) {
            callback(err, null)
        } else {
            // need to convert user ids to usernames
            async.each(friends, function(friendship, cb) {
                    let friendId = friendship.id1 === id ? friendship.id2 : friendship.id1
                    user_model.get_username_by_id(friendId, function(err, data) {
                        if (err) {
                            cb(err)
                        } else {
                            friendUsernames.push(data)
                            cb()
                        }
                    })
                },
                function(err) {
                    if (err) {
                        callback(err, null)
                    } else {
                        callback(err, friendUsernames)
                    }
                }
            )
        }
    })
}


/**
 * Gets a list of pending friend requests by id given a specific user's id
 * @param {*} id id of the user
 * @param {*} callback 
 */
var getFriendRequests = function(id, callback) {
    let params= {
        "TableName": TABLE_NAME,
        "IndexName": ID_INDEX,
        "KeyConditionExpression": "id2 = :v_id",
        "FilterExpression": "accepted = :v_false",
        "ExpressionAttributeValues": {
            ":v_id": id,
            ":v_false": false
        }
    }

    let friends = []
    let friendUsernames = []
    db.dynamoDB_query(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            // need to convert user ids to usernames
            friends = friends.concat(data.Items)
            async.each(friends, function(friendship, cb) {
                let friendId = friendship.id1
                user_model.get_username_by_id(friendId, function(err, data) {
                    if (err) {
                        cb(err)
                    } else {
                        friendUsernames.push(data)
                        cb()
                    }
                })
            },
                function(err) {
                    if (err) {
                        callback(err, null)
                    } else {
                        callback(err, friendUsernames)
                    }
                }
            )
        }
    })
}

/**
 * Accept friend request
 * @param {*} id1 sender id for request
 * @param {*} id2 receiver id for request - NOTE that this is the id of current user
 * @param {*} callback 
 */
var acceptFriendRequest = function(id1, id2, callback) {
    let params = {
        'TableName': TABLE_NAME,
        'Key': {
            'id1': id1,
            'id2': id2
        },
        'UpdateExpression': 'set accepted=:a, #d=:d',
        "ExpressionAttributeValues": {
            ":a": true,
            ":d": new Date().toISOString(),
            ":f": false
        },
        'ExpressionAttributeNames': {
            '#d': 'datetime'
        },
        "ConditionExpression": 'attribute_exists(id1) and accepted=:f'
    }
    db.dynamoDB_update(params, function(err, data) {
        if (err && err.code === 'ConditionalCheckFailedException') {
            callback("Request doesn't exist", null)
        } else if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

/**
 * Deletes a friendship entry between two users - used for decline request and remove friends
 * @param {*} id1 
 * @param {*} id2 
 * @param {*} callback 
 */
var deleteFriendship = function(id1, id2, callback) {
    let params1 = {
        "TableName": TABLE_NAME,
        "Key": {
            "id1": id1,
            "id2": id2
        }
    }
    let params2 = {
        "TableName": TABLE_NAME,
        "Key": {
            "id1": id2,
            "id2": id1
        }
    }

    params = [params1, params2]
    async.each(params, function(param, cb) {
        db.dynamoDB_delete(param, function(err, data) {
            if (err) {
                cb(err)
            } else {
                cb()
            }
        })
    }, function(err) {
        if (err) {
            callback(err, null)
        } else {
            callback(err)
        }
    })
}

var friend_model = {
    get_friendship: getFriendship,
    create_friend_request: createFriendRequest,
    accept_friend_request: acceptFriendRequest,
    delete_friendship: deleteFriendship,
    get_all_friends: getAllFriends,
    get_friend_requests: getFriendRequests
}

module.exports = friend_model;
