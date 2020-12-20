var db = require('./database')
var uuid = require('uuid');
var async = require("async");

const TABLE_NAME = 'chats'
const INDEX_NAME = 'userId-index'

const CHAT_TYPES = {
    'private': 0,
    'group': 1
}

/**
 * Creates a chat - private or group
 * @param {*} name 
 * @param {*} type - 0 for private, 1 for group
 * @param {*} userId1 - only used for private
 * @param {*} userId2 - only used for private
 * @param {*} callback 
 */
var createChat = function(name, type, userId1, userId2, callback) {
    let id = uuid.v4();
    let params = {
        'TableName': TABLE_NAME,
        'Item': {
            'id': id,
            'type': type,
        },
        'ConditionExpression': "attribute_not_exists(id)"
    }
    if (name) {
        params.Item.name = name
    }
    if (userId1) {
        params.Item.userId1 = userId1
    }
    if (userId2) {
        params.Item.userId2 = userId2
    }
    db.dynamoDB_put(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            // pass back chat id so we can create memberships
            callback(err, {'chatId': id})
        }
    })
}

/**
 * Used to create a private chat between two users - ensures no chat exists yet
 * @param {*} userId1 
 * @param {*} userId2 
 * @param {*} callback 
 */
var createPrivateChat = function(userId1, userId2, callback) {
    getPrivateChat(userId1, userId2, function(err, data) {
        if (err) {
            callback(err, null)
        } else if (data) {
            callback('Private chat already exists', null)
        } else {
            createChat(null, CHAT_TYPES.private, userId1, userId2, callback)
        }
    })
}

/**
 * Creates a group chat
 * @param {*} name 
 * @param {*} callback 
 */
var createGroupChat = function(name, callback) {
    createChat(name, CHAT_TYPES.group, null, null, callback)
}

/**
 * Gets the chat based on chatId
 * @param {*} chatId 
 * @param {*} callback 
 */
var getChat = function(chatId, callback) {
    let params = {
        "TableName": TABLE_NAME,
        "Key": {
            "id": chatId
        }
    }
    db.dynamoDB_get(params, callback)
}

/**
 * Gets chat id of private chat or creates a new private chat and passes back chat id
 * @param {*} userId1 
 * @param {*} userId2 
 * @param {*} callback 
 */
var getPrivateChat = function(userId1, userId2, callback) {
    let params1 = {
        "TableName": TABLE_NAME,
        "IndexName": INDEX_NAME,
        "KeyConditionExpression": "userId1 = :v_id1 and userId2 = :v_id2",
        "ExpressionAttributeValues": {
            ":v_id1": userId1,
            ":v_id2": userId2
        }
    }
    let params2 = {
        "TableName": TABLE_NAME,
        "IndexName": INDEX_NAME,
        "KeyConditionExpression": "userId1 = :v_id2 and userId2 = :v_id1",
        "ExpressionAttributeValues": {
            ":v_id1": userId1,
            ":v_id2": userId2
        }
    }

    params = [params1, params2]
    chat = [];
    async.each(params, function(param, cb) {
        db.dynamoDB_query(param, function(err, data) {
            if (err) {
                cb(err)
            } else if (data.Count > 0) {
                chat.push(data)
                cb()
            } else {
                cb()
            }
        })
    }, function(err) {
        if (err) {
            callback(err, null)
        } else if (chat.length) {
            callback(err, chat[0])
        } else {
            // return no error and null chat for DNE
            callback(err, null)
        }
    })
}

var chat_model = {
    create_private_chat: createPrivateChat,
    create_group_chat: createGroupChat,
    get_chat: getChat,
    get_private_chat: getPrivateChat,
    CHAT_TYPES, CHAT_TYPES
}

module.exports = chat_model;

