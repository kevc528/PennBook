var express = require('express');
var session = require('express-session')
var nodemailer = require("nodemailer");
var app=express();

const { validationResult } = require('express-validator');
var model = require('../models/user_model');
var postModel = require('../models/post_model');
const news_model = require('../models/news_model');
var randNums = [];

/**
 * Route function for checking first registration step (doesn't create an account)
 * Checks if a username/email is already taken
 * @param {*} req 
 * @param {*} res 
 */
var checkFirstRegistrationStep = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({'success': false, 'err': errors.errors[0].msg});
    } else {
        model.get_user_by_username(req.body.username, 'username', function(err, data) {
            if (err) {
                res.json({'success': false, 'err': err});
            } else {
                if (data.Count > 0) {
                    res.json({'success': false, 'err': "This username is already taken."});
                } else {
                    model.get_user_by_email(req.body.email, 'email', function(err, data) {
                        if (err) {
                            res.json({'success': false, 'err': err});
                        } else {
                            if (data.Count > 0) {
                                res.json({'success': false, 'err': "This email is already associated with an account."});
                            } else {
                                res.json({'success': true, 'err': null});
                            }
                        }
                    });
                }
            }
        });
    }
}


/**
 * Route function for creating an account
 * @param {*} req 
 * @param {*} res 
 */
var createAccount = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({'success': false, 'err': errors.errors[0].msg});
    } else {
        model.create_user(req.body.username, req.body.password, req.body.email, req.body.birthday,
            req.body.name, req.body.affiliation, req.body.interests, req.body.verfied,
            function(err, data) {
                if (err) {
                    res.json({'success': false, 'err': err})
                } else {
                    res.json({'success': true})
                }
            })
    }
}

/**
 * Route function for checking login info
 * @param {*} req 
 * @param {*} res 
 */
var checkLogin = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({'success': false, 'err': errors.errors[0].msg});
    } else {
        model.get_user_username_password(req.body.username, req.body.password, function(err, data) {
            if (data) {
                console.log(data.Items[0]);
                if (data.Items[0].verfied === "TRUE") {
                    req.session.logged_in_user = req.body.username
                    req.session.logged_in_id = data.Items[0].id
                    res.json({'success': true})
                } else {
                    res.json({'success': false, 'err': "You need to verify your account in order to login!"})
                }
            } else {
                res.json({'success': false, 'err': err})
            }
        })
    }
}

/**
 * Route function to get the account info of the logged in user from session
 * @param {*} req 
 * @param {*} res 
 */
var getLoggedInAccount = function(req, res) {
    if (req.session.logged_in_user) {
        model.get_user_by_username(req.session.logged_in_user,
            "username, email, birthday, #fullname, affiliation, interests",
            function(err, data) {
                if (err) {
                    res.json({'success': false, 'err': err})
                } else if (data.Items.length) {
                    res.json({'success': true, 'data': data.Items[0]})
                } else {
                    res.json({'success': false, 'err': 'No such user'})
                }
            }
        )
    } else {
        res.json({'success': false, 'error': 'No logged in user'})
    }
}

/**
 * Route function to get the profile of a given user
 * @param {*} req 
 * @param {*} res 
 */
var getUserProfile = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({'success': false, 'err': errors.errors[0].msg});
    } else {
        model.get_user_by_username(req.query.username,
            "username, email, birthday, #fullname, affiliation, interests",
            function(err, data) {
                if (err) {
                    res.json({'success': false, 'err': err})
                } else if (data.Items.length) {
                    res.json({'success': true, 'data': data.Items[0]})
                } else {
                    res.json({'success': false, 'err': 'No such user'})
                }
            }
        )
    }
}

/**
 * Route function for PATCH to update account info
 * @param {*} req 
 * @param {*} res 
 */
var updateAccount = function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({'success': false, 'err': errors.errors[0].msg})
    } else {
        model.update_user(req.session.logged_in_id, req.body.username, req.body.password, req.body.email, req.body.birthday,
            req.body.name, req.body.affiliation, req.body.interests, "TRUE",
            function(err, data) {
                if (err) {
                    res.json({'success': false, 'err': err})
                } else {
                    if (req.body.username) {
                        req.session.logged_in_user = req.body.username
                    }
                    
                    var userId = req.session.logged_in_id
                    if (req.body.interests) {
                        var interests = req.body.interests

                        news_model.call_recommend_job(news_model.JOB_TYPE.INTEREST)

                        if (interests.length === 1) {
                            var content = req.session.logged_in_user + " is now interested in " + interests + "."
                        } else if (interests.length === 2) {
                            var content = req.session.logged_in_user + " is now interested in " + interests[0] + " and " + interests[1] + "."
                        } else {
                            var content = req.session.logged_in_user + " is now interested in " + 
                            interests.slice(0, interests.length - 1).join(', ') + ", and " + interests.slice(-1) + "."
                        }

                        postModel.create_post(userId, userId, content, "status", function(err, data) {
                            if (err) {
                                res.json({'success': false, 'error': err})
                            } else {
                                if (req.body.affiliation && req.body.affiliation !== 'Select your affiliation (optional)') {
                                    var content2 = req.session.logged_in_user + "'s affiliation is now " + req.body.affiliation + "."
                                    postModel.create_post(userId, userId, content2, "status", function(err, data) {
                                        if (err) {
                                            res.json({'success': false, 'error': err})
                                        } else {
                                            res.json({'success': true, 'data': data})
                                        }
                                    })
                                } else {
                                    res.json({'success': true, 'data': data})
                                }
                            }
                        })
                    } else if (req.body.affiliation && req.body.affiliation !== 'Select your affiliation (optional)') {
                        var content2 = req.session.logged_in_user + "'s affiliation is now " + req.body.affiliation + "."
                        postModel.create_post(userId, userId, content2, "status", function(err, data) {
                            if (err) {
                                res.json({'success': false, 'error': err})
                            } else {
                                res.json({'success': true, 'data': data})
                            }
                        })
                    } else {
                        res.json({'success': true, 'data': data})
                    }
                }
            })
    }
}

var logout = function(req, res) {
    req.session.destroy()
    res.redirect("/login");
}

// function that allows us send people emails
var smtpTransport = nodemailer.createTransport({
    service: "Gmail",
    auth: {
    	//dummy email we created
        user: "net212pennbook",
        pass: "ilovenodejs"
    }
});


// Request to send email verfication 
var sendEmail = function(req, res) {
	rand=Math.floor((Math.random() * 100) + 54);
	randNums.push(rand);
    host=req.get('host');
    link="http://"+req.get('host')+"/verify?id="+rand;
    mailOptions={
        to : req.query.to,
        subject : "Welcome to PennBook! Please Verify your email!",
        html : "Hello,<br> Please Click on the link to verify your email.<br><a href="+link+">Click here to verify</a>"
    }
    console.log(mailOptions);

    smtpTransport.sendMail(mailOptions, function(error, response){});
	res.render('account/verify.ejs', {value: 1, email: mailOptions.to, message: "Email"});

};

// Request to verify email
var verify = function(req, res){		  	 		
		if((req.protocol+"://"+req.get('host'))==("http://"+host))
		{
			//checks if id sent in email matches one stored in cache


		    if(randNums.includes(req.query.id) || randNums.includes(rand) ) {
		    	model.verifyUser(mailOptions.to,"TRUE",  function(err, data) {
	                if (err) {
	    		    	res.render('account/verify.ejs', {value: 1, email: mailOptions.to,message: err});
	                } else {
	    		    	res.render('account/verify.ejs', {value: 1, email: mailOptions.to,message: "Email " +mailOptions.to+ " has been successfully verified"});
                   
	                }
	            });
		         
		   		}
		else {
	      res.render('account/verify.ejs', {value: 2, email: mailOptions.to, message: "Email has not been verified. Expired Request. Please request a new email."});
		}
	};
}


var user_routes = {
    create_account: createAccount,
    check_login: checkLogin,
    update_account: updateAccount,
    get_logged_in_account: getLoggedInAccount,
    check_first_registration_step: checkFirstRegistrationStep,
    logout: logout,
    get_user_profile: getUserProfile,
    verify: verify,
    sendEmail: sendEmail
}



module.exports = user_routes
