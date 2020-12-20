var db = require('../models/database.js');
var uuid = require('uuid');
const bcrypt = require('bcrypt');
const fs = require('fs')
var async = require("async");
var stemmer = require('stemmer')


const TABLE_NAME = 'users';
const USERNAME_INDEX = 'username-index';
const EMAIL_INDEX = 'email-index';
const saltRounds = 10;

/**
 * Function for getting existance of a user by username - DON'T EXPOSE PROJECTION 
 * for client-side manipulation
 * @param {*} username 
 * @param {*} projection projection string for the data - comma separated columns 
 * Ex: "username, name" if you want to just get the username and name columns
 * @param {*} callback function(err, data)
 */
var getUserByUsername = function(username, projection, callback) {
    //console.log(username)
    let user;
    if (username) {
        user = username.toLowerCase();
    }
	let params = {
        "TableName": TABLE_NAME,
        "IndexName": USERNAME_INDEX,
        "KeyConditionExpression": "username = :v_username",
        "ExpressionAttributeValues": {
            ":v_username": user
        },
        "ProjectionExpression": projection
    }

    if (projection.includes("#fullname")) {
        params['ExpressionAttributeNames'] = {'#fullname': 'name'}
    }

    db.dynamoDB_query(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}


//function for searching users given a generic search term(s)
var searchUsers = function(searchType, searchTerm, currUserId, withNewsSort, callback) {
	if( searchType == "USER") {
        //blank array which will eventually contain the results of the query  
        let results = [];
        let idToItem = {};
        let idCounter = {};
        
        searchTerm = searchTerm.trim();
        var arr = searchTerm.split(/\s+/);
        var newArr = [...arr];
        var i;
        for (i = 0; i < newArr.length; i++) {
            newArr[i] = newArr[i].toLowerCase();
        }
        
        async.eachOf(newArr, function(term, idx, cb) {

           // searches db table for users
           let params = {
                "TableName": TABLE_NAME,
                "IndexName": "verfied-index",
                "KeyConditionExpression": "verfied = :v_VERFIED",  
                "FilterExpression" : "(contains(#holder_name, :v_searchTerm) or contains(#holder_name, :v_searchTerm1) or contains(#holder_name, :v_searchTerm2))",
                "ExpressionAttributeValues": {
                    ":v_searchTerm": term,
                    ":v_searchTerm1":  term.charAt(0).toUpperCase() + term.slice(1),
                    ":v_searchTerm2":  arr[idx],
                    ":v_VERFIED":  "TRUE",
                },
                "ExpressionAttributeNames": {
                    "#holder_name": "name"	        
                },
            }

           db.dynamoDB_query(params, function(err, data) {
               if (err) {
                   cb(err)
               } else {
                   data.Items.forEach(function(item) {
                       if (idCounter[item.id]) {
                           idCounter[item.id] = idCounter[item.id] + 1;
                       } else {
                           idCounter[item.id] = 1;
                       }
                       idToItem[item.id] = item;
                   });	   
                   cb()
               }
           })
           
       }, function(err) {
           if (err) {
               callback(err, null)
           } else {
               let sortedIdEntries = Object.entries(idCounter);
               sortedIdEntries = sortedIdEntries.sort((a, b) => b[1] - a[1]);
               let sortedIds = sortedIdEntries.map((entry) => entry[0]);
               results = sortedIds.map((url) => idToItem[url]);
               callback(err, results)
           }
       })
	    
	} else if (searchType == "NEWS") {
		 //blank array which will eventually contain the results of the query  
         let results = [];
         let urlToItem = {};
         let urlCounter = {};
		 
		 searchTerm = searchTerm.trim();
		 var arr = searchTerm.split(/\s+/);
		 var i;
		 for (i = 0; i < arr.length; i++) {
			 arr[i] = stemmer(arr[i].toLowerCase());
		 }
         
         // searches db table for news
         async.eachOf(arr, function(term, idx, cb) {
		    var params = {
			      TableName : "inverted",
			      KeyConditionExpression: "#kw = :keyw",
			      ExpressionAttributeNames:{
			          "#kw": "keyword"
			      },
			      ExpressionAttributeValues: {
			          ":keyw": term
			      }
			}; 
			db.dynamoDB_query(params, function(err, data) {
		        if (err) {
		        	cb(err)
		        } else {
		        	data.Items.forEach(function(item) {
                        if (urlCounter[item.url]) {
                            urlCounter[item.url] = urlCounter[item.url] + 1;
                        } else {
                            urlCounter[item.url] = 1;
                        }
                        urlToItem[item.url] = item;
                    });	   
                    cb()
		        }
            })
        }, function(err) {
            if (err) {
                callback(err, null)
            } else {
                let allUrls = [];
                if (withNewsSort) {
                    for (const url in urlToItem) {
                        allUrls.push(url);
                    }
                }
                async.eachOf(allUrls, function(url, idx, cb) {
                    let weightParams = {
                        TableName : "news-recommendations-weights",
                        "Key": {
                            "link": url,
                            "userId": currUserId
                        }
                    }; 
                    db.dynamoDB_get(weightParams, function(err, weightData) {
                        if (err) {
                            console.log(err);
                        } else {
                            if (weightData) {
                                if (weightData.Item) {
                                    urlToItem[url].weight = weightData.Item.weight;
                                } else {
                                    urlToItem[url].weight = 0;
                                }
                            }
                        }
                        cb()
                    });
                }, function(err) {
                    if (err) {
                        callback(err, null)
                    } else {
                        let sortedUrlEntries = Object.entries(urlCounter);
                        if (withNewsSort) {
                            sortedUrlEntries = sortedUrlEntries.sort((a, b) => b[1] - a[1] || urlToItem[b[0]].weight - urlToItem[a[0]].weight);
                        }
                        let sortedUrls = sortedUrlEntries.map((entry) => entry[0]);
                        results = sortedUrls.map((url) => urlToItem[url]);
                        callback(err, results);
                    }
                })
            }
        })
	}
}

var verifyUser = function(email, verfied, callback) {
	   let params = {
		        "TableName": TABLE_NAME,
		        "IndexName": EMAIL_INDEX,
		        "KeyConditionExpression": "email = :v_email",
		        "ExpressionAttributeValues": {
		            ":v_email": email.toLowerCase(),
		        },
		    }

		     
		    db.dynamoDB_query(params, function(err, data) {
		        if (err) {
		            callback(err, null)
		        } else {
		            data.Items.forEach(function(item) {
		                var id = item.id;
		                let params1 = {
		            	        'TableName': TABLE_NAME,
		            	        'Key': {
		            	            'id':id
		            	        },
		            	        'UpdateExpression': 'set verfied = :v',
		            	        'ExpressionAttributeValues': {
		            	             ":v":"TRUE"	        	
		            	        },
		            	       
		            	    }
		                db.dynamoDB_update(params1, callback);

		            });

		        }
		    }) 
}

/**
 * Used for the walls - translate user id to username - YOU CAN ADD TO PROJECTION EXPRESSION IF YOU NEED MORE INFO
 * @param {*} userId 
 * @param {*} callback 
 */
var getUsernameById = function(userId, callback) {
    let params = {
        "TableName": TABLE_NAME,
        "Key": {
            "id": userId
        },
        "ProjectionExpression": "username"
    }
    db.dynamoDB_get(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else if (data.Item) {
            callback(err, data.Item.username)
        } else {
            callback('No user id', null)
        }
    })
}

/**
 * Used to verify no duplicate emails
 * @param {*} email 
 * @param {*} callback 
 */
var getUserByEmail = function(email, projection, callback) {
    let params = {
        "TableName": TABLE_NAME,
        "IndexName": EMAIL_INDEX,
        "KeyConditionExpression": "email = :v_email",
        "ExpressionAttributeValues": {
            ":v_email": email.toLowerCase(),
        },
        "ProjectionExpression": projection
    }

    if (projection.includes("#fullname")) {
        params['ExpressionAttributeNames'] = {'#fullname': 'name'}
    }

    db.dynamoDB_query(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            callback(err, data)
        }
    })
}

/**
 * Function for getting existance of a user by username and password - USE FOR LOGIN
 * @param {*} username
 * @param {*} password
 * @param {*} callback function(err, data)
 */
var getUserByUsernameAndPassword = function(username, password, callback) {
    let params = {
        "TableName": TABLE_NAME,
        "IndexName": USERNAME_INDEX,
        "KeyConditionExpression": "username = :v_username",
        "ExpressionAttributeValues": {
            ":v_username": username.toLowerCase()
        },
        "ProjectionExpression": "username, password, id, verfied"
    }
    db.dynamoDB_query(params, function(err, data) {
        if (err) {
            callback(err, null)
        } else {
            if (!data.Items.length) {
                callback("Incorrect username or password. Please try again.", null)
            } else {
                bcrypt.compare(password, data.Items[0].password, function(err, result) {
                    if (err) {
                        callback(err, null)
                    } else {
                        if (result) {
                            callback(err, data);
                        } else {
                            callback("Incorrect username or password. Please try again.", null)
                        }
                    }
                })
            }
        }
    })
}

/**
 * Create a user and add it to the database
 * @param {*} username 
 * @param {*} password 
 * @param {*} email 
 * @param {*} birthday 
 * @param {*} name 
 * @param {*} affiliation 
 * @param {*} interests 
 * @param {*} callback function is in the form function(err, data)
 */
var createUser = function(username, password, email, birthday, name, 
                            affiliation, interests, verfied, callback) { 
    getUserByUsername(username, "username", function(err, data) {
        if (err) {
            callback(err, null)
        } else if (data.Items.length == 0) {
            let id = uuid.v4(); //10^-37 chance of collision
            bcrypt.hash(password, saltRounds, function(err, hash) {
                if (err) {
                    callback(err, null)
                } else {
                    let params = {
                        'TableName': TABLE_NAME,
                        'Item': {
                            'id': id,
                            'username': username.toLowerCase(),
                            'password': hash,
                            'email': email.toLowerCase(),
                            'birthday': birthday,
                            'name': name,
                            'affiliation': affiliation,
                            'interests': interests ? interests : [],
                            'verfied' : verfied
                        },
                        'ConditionExpression': "attribute_not_exists(id)"
                    }
                    db.dynamoDB_put(params, function(err, data) {
                        if (err) {
                            callback(err, null)
                        } else {
                            callback(err, {'id': id})
                        }
                    });
                }
            })
        } else {
            callback("Username already exists", null)
        }
    })
}

/**
 * Update a user with a specific id - fields are either populated are null
 * @param {*} id - REQUIRED
 * @param {*} username 
 * @param {*} password 
 * @param {*} email 
 * @param {*} birthday 
 * @param {*} name 
 * @param {*} affiliation 
 * @param {*} interests 
 * @param {*} callback 
 */
var updateUser = function(id, username, password, email, birthday, name, 
                            affiliation, interests, verfied, callback) {
    let updated_values = {}
    let params = {
        'TableName': TABLE_NAME,
        'Key': {
            'id': id
        },
        'UpdateExpression': 'set',
        'ExpressionAttributeValues': updated_values,
        'ExpressionAttributeNames': {
            '#fullname': 'name'
        },
        'ConditionExpression': 'attribute_exists(id)'
    }

    if (email) {
        updated_values[':e'] = email.toLowerCase()
        params.UpdateExpression += ', email = :e'
    }
    if (birthday) {
        updated_values[':b'] = birthday
        params.UpdateExpression += ', birthday = :b'
    }
    if (name) {
        updated_values[':n'] = name
        params.UpdateExpression += ', #fullname = :n'
    } else {
        delete params['ExpressionAttributeNames']
    }
    if (affiliation != 'Select your affiliation (optional)') {
        updated_values[':a'] = affiliation
        params.UpdateExpression += ', affiliation = :a'
    }
    if (interests) {
        updated_values[':i'] = interests
        params.UpdateExpression += ', interests = :i'
        	
    } 
    if (verfied) {
        updated_values[':v'] = verfied
        params.UpdateExpression += ', verfied = :v'
    }
    if (username) {
        // need to make sure that the username is not duplicated
        getUserByUsername(username, "username", function(err, data) {
            if (err) {
                callback(err, null)
            } else if (data.Items.length == 0) {
                updated_values[':u'] = username.toLowerCase()
                params.UpdateExpression += ', username = :u'
                if (password) {
                    bcrypt.hash(password, saltRounds, function(err, hash) {
                        if (err) {
                            callback(err, null)
                        } else {
                            updated_values[':p'] = hash
                            params.UpdateExpression += ', password = :p'
                            params.UpdateExpression = params.UpdateExpression.replace(',', '')
                            db.dynamoDB_update(params, callback)
                        }
                    })
                } else {
                    params.UpdateExpression = params.UpdateExpression.replace(',', '')
                    db.dynamoDB_update(params, callback)
                }
            } else {
                callback("Username already exists", null)
            }
        })
    }
    // special case where the password needs additional handling for hashing
    else if (password) {
        bcrypt.hash(password, saltRounds, function(err, hash) {
            if (err) {
                callback(err, null)
            } else {
                updated_values[':p'] = hash
                params.UpdateExpression += ', password = :p'
                params.UpdateExpression = params.UpdateExpression.replace(',', '')
                db.dynamoDB_update(params, callback)
            }
        })
    } else {
        if (params.UpdateExpression.length > 3) {
            params.UpdateExpression = params.UpdateExpression.replace(',', '')
            db.dynamoDB_update(params, callback)
        } else {
            callback('No updates passed in', null)
        }
    }
}

var user_model = {
    create_user: createUser,
    get_user_username_password: getUserByUsernameAndPassword,
    update_user: updateUser,
    get_user_by_username: getUserByUsername,
    get_username_by_id: getUsernameById,
    get_user_by_email: getUserByEmail,
    verifyUser: verifyUser,
    search_users: searchUsers
}

module.exports = user_model;
