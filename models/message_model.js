var db = require('./database')
var async = require("async");
var userModel = require('./user_model');
const TABLE_NAME = 'messages'

/**
 * Enum for different "types" used in the message table
 */
const MESSAGE_CODES = {
    message: 0,
    join: 1, // accepted invite
    decline: 2, // declined invite
    leave: 3 // person left chat
}

/**
 * Posts a message for a given author (user) in a chat
 * @param {*} chatId 
 * @param {*} authorId 
 * @param {*} content - the message contents
 * @param {*} callback 
 */
var postMessage = function(chatId, authorId, content, callback) {
    let params = {
        'TableName': TABLE_NAME,
        'Item': {
            'chatId': chatId,
            'authorId': authorId,
            'content': content,
            'type': MESSAGE_CODES.message,
            'datetime': new Date().toISOString()
        }
    }
    db.dynamoDB_put(params, callback)
}

/**
 * Specifically used for posting chat events, like new members, reject invites, etc.
 * @param {*} chatId 
 * @param {*} eventType - types are specified in MESSAGE_CODES enum
 * @param {*} userId 
 * @param {*} callback
 */
var postEvent = function(chatId, eventType, userId, callback) {
    let params = {
        'TableName': TABLE_NAME,
        'Item': {
            'chatId': chatId,
            'type': eventType,
            'authorId': userId,
            'datetime': new Date().toISOString()
        }
    }
    db.dynamoDB_put(params, callback)
}

/**
 * Gets all the messages from a chat - makes sure to check the user is in the chat
 * @param {*} chatId 
 * @param {*} startDatetime 
 * @param {*} userId 
 * @param {*} callback 
 */
var getChatMessages = function(chatId, startDatetime, userId, callback) {
    getMessagesFromChat(chatId, startDatetime, null, callback)
}

/**
 * Get's the newest message in chat - useful for sorting the chats
 * @param {*} chatId 
 * @param {*} callback 
 */
var getNewestMessage = function(chatId, callback) {
    getMessagesFromChat(chatId, null, 1, callback)
}

/**
 * Helper function that get's however many specified messages from a chat - returns exclusive start key
 * for lazy loading if needeed
 * @param {*} chatId 
 * @param {*} startDatetime 
 * @param {*} limit 
 * @param {*} callback 
 */
var getMessagesFromChat = function(chatId, startDatetime, limit, callback) {
    let startKey;
    // create exclusive start key if needed
    if (startDatetime) {
        startKey = {
            "chatId": chatId,
            "datetime": startDatetime
        }
    }

    let params = {
        "TableName": TABLE_NAME,
        "KeyConditionExpression": "chatId = :chatId",
        "ExpressionAttributeValues": {
            ":chatId": chatId,
        },
        "ScanIndexForward": false,
    }

    if (limit) {
        params['Limit'] = limit
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
                    'type': x.type
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
                        'messages': transformedData,
                        'LastEvaluatedKey': lastEvaluatedKey
                    }
                    callback(err, resData)
                }
            })
        } else {
            callback(err, data.Items)
        }
    })
}

var message_model = {
    post_message: postMessage,
    get_chat_messages: getChatMessages,
    get_newest_message: getNewestMessage,
    post_event: postEvent,
    MESSAGE_CODES: MESSAGE_CODES
}

module.exports = message_model
