const { validationResult } = require('express-validator');
var friendModel = require('../models/friend_model');
var userModel = require('../models/user_model');
var model = require('../models/vis_model');

/* 
 * Visualizer
 */
var getFriendVisualization = function(req, res) {
	userModel.get_user_by_username(req.session.logged_in_user, "id, username, affiliation", function(err, data) {
        if (err) {
            res.json({'success': false, 'error': err})
        } else if (data.Items.length) {
            let json = {"id": data.Items[0].username, "affiliation": data.Items[0].affiliation}
            
            let userId = data.Items[0].id
            let userAff = data.Items[0].affiliation
            friendModel.get_all_friends(userId, function(err, data) {
                if (err) {
                    res.json({'success': false, 'error': err})
                } else {
                    let jsonNodes = [];
                    data.forEach(element => jsonNodes.push({"id": element, "children": []}))
                    
                    model.get_same_aff(userAff, function(err, data) {
                        if (err) {
                            res.json({'success': false, 'error': err})
                        } else {
                            data.Items.forEach(element => jsonNodes.push({"id": element.username, "children": []}))
                            
                            for (var i = 0; i < jsonNodes.length; i++) {
                                if (jsonNodes[i] === req.session.logged_in_user) {
                                    jsonNodes.splice(i, 1);
                                }
                            }
                            
                            json["children"] = jsonNodes
                            res.json(json)
                        }
                    })
                }
            })
        } else {
            res.json({'success': false, 'error': 'No such user'})
        }
    })
}

var getNodeChildren = function(req, res) {    
    userModel.get_user_by_username(req.params.user, "id, username, affiliation", function(err, data) {
        if (err) {
            res.json({'success': false, 'error': err})
        } else if (data.Items.length) {
            let json = {"id": data.Items[0].username, "affiliation": data.Items[0].affiliation}
            
            let userId = data.Items[0].id
            let userAff = data.Items[0].affiliation
            friendModel.get_all_friends(userId, function(err, data) {
                if (err) {
                    res.json({'success': false, 'error': err})
                } else {
                    let jsonNodes = [];
                    data.forEach(element => jsonNodes.push({"id": element, "children": []}))
                    
                    model.get_same_aff(userAff, function(err, data) {
                        if (err) {
                            res.json({'success': false, 'error': err})
                        } else {
                            data.Items.forEach(element => jsonNodes.push({"id": element.username, "children": []}))
                            
                            for (var i = 0; i < jsonNodes.length; i++) {
                                if (jsonNodes[i] === req.session.logged_in_user) {
                                    jsonNodes.splice(i, 1)
                                }
                            }
                            json["children"] = jsonNodes
                            res.json(json)
                        }
                    })
                }
            })
        } else {
            res.json({'success': false, 'error': 'No such user'})
        }
    })
}

// Create routes for app.js
var vis_routes = { 
    get_friend_visualization: getFriendVisualization,
    get_node_children: getNodeChildren
};
  
module.exports = vis_routes;