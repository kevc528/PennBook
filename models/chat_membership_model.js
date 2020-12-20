var db = require('./database')
const { get_friendship } = require('./friend_model')
const TABLE_NAME = 'chat-memberships'
const USERID_INDEX = 'userId-index'
const CHATID_INDEX = 'chatId-index'
var async = require("async");
const { get_username_by_id } = require('./user_model');
const { get_newest_message } = require('./message_model');
const { get_chat, CHAT_TYPES } = require('./chat_model')

/**
 * Function to create a chat invite
 * @param {*} chatId - id of the chat
 * @param {*} userId - id of the user who the membership belongs to
 * @param {*} inviterId - who invited
 * @param {*} accepted - true or false for accepted invite or pending accept
 * @param {*} callback 
 */
var createMembershipInvite = function(chatId, userId, inviterId, callback) {
    // need to check the membership of the inviter
    getMembership(chatId, inviterId, function(err, data) {
        if (err) {
            callback(err, null)
        } else if (data === 'Member') {
            // can only send chat invites to friends
            get_friendship(userId, inviterId, function(err, friendData) {
                if (err) {
                    callback(err, null)
                } else if (friendData && friendData.Items[0].accepted) {
                    createMembership(chatId, userId, inviterId, false, callback)
                } else {
                    callback('Not friends', null)
                }
            })
        } else {
            callback('Inviter not a member', null)
        }
    })
}

/**
 * CREATES A MEMBERSHIP WITHOUT ANY PERMISSION CHECKING - BE CAREFUL FOR USING THIS
 * @param {*} chatId - id of the chat
 * @param {*} userId - id of the user who the membership belongs to
 * @param {*} inviterId - who invited
 * @param {*} accepted - true or false for accepted invite or pending accept
 * @param {*} callback 
 */
var createMembership = function(chatId, userId, inviterId, accepted, callback) {
    let params = {
        'TableName': TABLE_NAME,
        'Item': {
            'chatId': chatId,
            'userId': userId,
            'inviterId': inviterId,
            'accepted': accepted,
            'datetime': new Date().toISOString()
        },
        'ConditionExpression': 'attribute_not_exists(userId)'
    }
    db.dynamoDB_put(params, callback)
}

/**
 * Get a membership of a specific user for a chat
 * @param {*} chatId 
 * @param {*} userId 
 * @param {*} callback 
 */
var getMembership = function(chatId, userId, callback) {
    let params = {
        "TableName": TABLE_NAME,
        "Key": {
            "chatId": chatId,
            "userId": userId
        },
        "ProjectionExpression": "accepted"
    }
    db.dynamoDB_get(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else if (data.Item) {
            callback(err, data.Item.accepted ? 'Member' : 'Invited')
        } else {
            callback(err, 'No membership')
        }
    })
}


var getMembersInChat = function(chatId, callback) {
    let params = {
        "TableName": TABLE_NAME,
        "IndexName": CHATID_INDEX,
        "KeyConditionExpression": "chatId = :chatId",
        "ExpressionAttributeValues": {
            ":chatId": chatId
        },
        "ProjectionExpression": "userId, accepted"
    }
    db.dynamoDB_query(params, callback)
}

/**
 * Get's all invites for a user
 * @param {*} userId 
 * @param {*} callback 
 */
var getAllInvites = function(userId, callback) {
    let params = {
        "TableName": TABLE_NAME,
        "IndexName": USERID_INDEX,
        "KeyConditionExpression": "userId = :userId",
        "ExpressionAttributeValues": {
            ":userId": userId,
            ":f": false
        },
        "FilterExpression": "accepted = :f",
        "ScanIndexForward": false,
        "ProjectionExpression": "chatId, inviterId"
    }
    db.dynamoDB_query(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            let invites = data.Items.map(x => ({'chatId': x.chatId}))
            async.eachOf(data.Items, function(invite, idx, cb) {
                get_username_by_id(invite.inviterId, function(err, data) {
                    if (err) {
                        cb(err)
                    } else {
                        invites[idx]['inviter'] = data
                        cb()
                    }
                })
            }, function(err) {
                if (err) {
                    callback(err)
                } else {
                    callback(err, invites)
                }
            })
        }
    })
}

/**
 * Accept a friend request from a given chat
 * @param {*} chatId 
 * @param {*} userId 
 * @param {*} callback 
 */
var acceptInvite = function(chatId, userId, callback) {
    let params = {
        'TableName': TABLE_NAME,
        'Key': {
            'userId': userId,
            'chatId': chatId
        },
        'UpdateExpression': 'set accepted=:a, #d=:d',
        "ExpressionAttributeValues": {
            ":a": true,
            ":f": false,
            ":d": new Date().toISOString()
        },
        'ExpressionAttributeNames': {
            '#d': 'datetime'
        },
        "ConditionExpression": 'attribute_exists(userId) and accepted=:f'
    }
    db.dynamoDB_update(params, function(err, data) {
        if (err && err.code === 'ConditionalCheckFailedException') {
            callback("Invite doesn't exist", null)
        } else if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

/**
 * Delete a membership in a chat - useful for rejecting invites, leaving chats, and used to delete 
 * all members once a chat is deleted
 * @param {*} chatId 
 * @param {*} userId 
 * @param {*} callback 
 */
var deleteMembership = function(chatId, userId, callback) {
    let params = {
        'TableName': TABLE_NAME,
        'Key': {
            'userId': userId,
            'chatId': chatId
        },
        'ConditionExpression': 'attribute_exists(userId)'
    }
    db.dynamoDB_delete(params, function(err, data) {
        if (err && err.code === 'ConditionalCheckFailedException') {
            callback("Membership doesn't exist", null)
        } else if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

/**
 * Gets all chats that a user is a member of - sorted
 * @param {*} userId 
 * @param {*} callback 
 */
var getAllChatMemberships = function(userId, callback) {
    let params = {
        "TableName": TABLE_NAME,
        "IndexName": USERID_INDEX,
        "KeyConditionExpression": "userId = :userId",
        "ExpressionAttributeValues": {
            ":userId": userId,
            ":t": true
        },
        'ExpressionAttributeNames': {
            '#d': 'datetime'
        },
        "ScanIndexForward": false,
        "FilterExpression": "accepted = :t",
        "ProjectionExpression": "chatId, #d"
    }
    db.dynamoDB_query(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            let chats = []
            async.each(data.Items, function(chat, cb) {
                get_chat(chat.chatId, function(err, chatData) {
                    if (err) {
                        cb(err)
                    } else if (chatData.Item.type === CHAT_TYPES.private) {
                        get_username_by_id(chatData.Item.userId1 === userId ? chatData.Item.userId2 : chatData.Item.userId1,
                            function(err, nameData) {
                                if (err) {
                                    cb(err)
                                } else {
                                    get_newest_message(chatData.Item.id, function(err, recentData) {
                                        if (err) {
                                            cb(err)
                                        } else {
                                            chats.push(
                                                {
                                                    'id': chatData.Item.id,
                                                    'name': nameData,
                                                    'newest': recentData.messages[0],
                                                }
                                            )
                                            cb()
                                        }
                                    })
                                }
                        })
                    } else {
                        get_newest_message(chatData.Item.id, function(err, recentData) {
                            if (err) {
                                cb(err)
                            } else {
                                chats.push(
                                    {
                                        'id': chatData.Item.id,
                                        'name': chatData.Item.name,
                                        'newest': recentData.messages[0],
                                    }
                                )
                                cb()
                            }
                        })
                    }
                })
            }, function(err) {
                if (err) {
                    callback(err, null)
                } else {
                    chats = chats.sort((a, b) => b.newest.datetime.localeCompare(a.newest.datetime))
                    callback(err, chats)
                }
            })
        }
    })
}

var chat_membership_model = {
    create_membership: createMembership,
    create_invite: createMembershipInvite,
    get_membership: getMembership,
    accept_invite: acceptInvite,
    delete_membership: deleteMembership,
    get_chat_memberships: getAllChatMemberships,
    get_user_invites: getAllInvites,
    get_members_in_chat: getMembersInChat
}

module.exports = chat_membership_model;
