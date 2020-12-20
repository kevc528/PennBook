var AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var docClient = new AWS.DynamoDB.DocumentClient();

/**
 * Standard DynamoDB put function
 * @param {*} params DynamoDb formatted params - check documentation for more info
 * @param {*} callback Callback function for after the put - first arg is err, second is data about
 * item that was put
 */
var dynamoDBPut = function(params, callback) {
    docClient.put(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

/**
 * Standard DynamoDB get function
 * @param {*} params DynamoDb formatted params - check documentation for more info
 * @param {*} callback Callback function for after the get - first arg is err, second is data about
 * item that was get
 */
var dynamoDBGet = function(params, callback) {
    docClient.get(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

/**
 * Standard DynamoDB update function
 * @param {*} params DynamoDb formatted params - check documentation for more info
 * @param {*} callback Callback function for after the update - first arg is err, second is data about
 * item that was updated
 */
var dynamoDBUpdate = function(params, callback) {
    docClient.update(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

/**
 * Standard DynamoDB delete function
 * @param {*} params DynamoDb formatted params - check documentation for more info
 * @param {*} callback Callback function for after the delete - first arg is err, second is data about
 * item that was delete
 */
var dynamoDBDelete = function(params, callback) {
    docClient.delete(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

/**
 * Standard DynamoDB query function
 * @param {*} params DynamoDb formatted params - check documentation for more info
 * @param {*} callback Callback function for after the query - first arg is err, second is data about
 * items that are returned from query
 */
var dynamoDBQuery = function(params, callback) {
    docClient.query(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

// temp !!
var dynamoDBScan = function(params, callback) {
    docClient.scan(params, function(err, data) {
        if (err) {
        	console.log(err);
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}


var database = { 
    dynamoDB_put: dynamoDBPut,
    dynamoDB_get: dynamoDBGet,
    dynamoDB_update: dynamoDBUpdate,
    dynamoDB_delete: dynamoDBDelete,
    dynamoDB_query: dynamoDBQuery, 
    dynamoDB_scan: dynamoDBScan
};

module.exports = database;
                                        