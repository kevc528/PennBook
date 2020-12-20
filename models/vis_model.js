var db = require('./database')
var postModel = require('./post_model')
var async = require("async")
var userModel = require('./user_model')

const TABLE_NAME = 'users';

/**
 * Get's a list of friends by id given a specific user's id
 * @param {*} id id of the user
 * @param {*} callback 
 */
var getSameAff = function(aff, callback) {
    let params = {
        "TableName": TABLE_NAME,
        "FilterExpression": "affiliation = :v_aff",
        "ExpressionAttributeValues": {
            ":v_aff": aff,
        },
        "ProjectionExpression": "username"
    }

    db.dynamoDB_scan(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

var vis_model = {
    get_same_aff: getSameAff
}

module.exports = vis_model;