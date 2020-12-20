var chat_membership_model = require('../models/chat_membership_model');
var userModel = require('../models/user_model');


/* Routes for all visible pages */

/* 
 * Account Pages (requires login) 
 */
var getLoginPage = function(req, res) {
    if (req.session.logged_in_user) {
        res.redirect("/");
    } else {
        res.render('account/login.ejs');
    }
}

var getRegisterPage = function(req, res) {
    if (req.session.logged_in_user) {
        res.redirect("/");
    } else {
        res.render('account/register.ejs');
    }
}

/* 
 * Main Functionality Pages (requires login) 
 */
var getProfilePage = function(req, res) {
    if (req.session.logged_in_user) {
        res.render('main/profile.ejs');
    } else {
        res.redirect("/login");
    }
}

/* 
 * Main Functionality Pages (requires login) 
 */
var getHomePage = function(req, res) {
    if (req.session.logged_in_user) {
        res.render('main/home.ejs');
    } else {
        res.redirect("/login");
    }
}

// For viewing other's profiles (viewable when not logged in)
var getOtherProfilePage = function(req, res) {
    if (req.session.logged_in_user) {
        if (req.query.username == req.session.logged_in_user) {
            res.redirect("/profile");
        } else {
            res.render('main/otherprofile.ejs');
        } 
    } else {
        res.render('main/otherprofile.ejs');
    }
}

var getChatPage = function(req, res) {
    if (req.session.logged_in_user) {
        chat_model.get
        res.render('main/chat.ejs');
    } else {
        res.redirect("/login");
    }
}

var getSettingsPage = function(req, res) {
    if (req.session.logged_in_user) {
        res.render('main/settings.ejs');
    } else {
        res.redirect("/login");
    }
}

// function to search for users
var getUserSearchResultsPage = function(req, res) {
	var searchTerm = req.query.searchTerm; // search for users
	var searchType = "";

	if (req.session.logged_in_user) {    
		
        if(searchTerm) {
            searchTerm = searchTerm.trim();
            searchType = "USER";
            
            userModel.search_users(searchType,searchTerm,req.session.logged_in_id, false, function(err, data) {
                    if (err) {
                        res.render('main/searchresults.ejs', {message: err, info: data});
                    } else if (data) {
                        res.render('main/searchresults.ejs', {type: searchType, message: searchTerm, info: data, user: req.session.logged_in_user});        	
                    } else {
                        res.render('main/searchresults.ejs', {message: "Something went wrong"});
                    }
                });   
        } else {
            res.redirect('back');
        } 
    } else {
        res.redirect("/login");
    }
}


// function to search for news
var getNewsSearchResultsPage = function(req, res) {
	var searchTerm = req.query.searchTerm; // search for news
	var searchType = "";

	if (req.session.logged_in_user) {    
		
        if(searchTerm) {
            searchTerm = searchTerm.trim();
            searchType = "NEWS";
            
            userModel.search_users(searchType,searchTerm,req.session.logged_in_id, true, function(err, data) {
                    if (err) {
                        res.render('main/searchresults.ejs', {message: err, info: data});
                    } else if (data) {
                        res.render('main/searchresults.ejs', {type: searchType, message: searchTerm, info: data, user: req.session.logged_in_user});        	
                    } else {
                        res.render('main/searchresults.ejs', {message: "Something went wrong"});
                    }
                });   
        } else {
            res.redirect('back');
        } 
    } else {
        res.redirect("/login");
    }
}

// Function to get user suggestions, not the full page
var getUserSearchResultsSuggestions = function(req, res) {
	var searchTerm = req.query.searchTerm; // search for users
	var searchType = "";

	if (req.session.logged_in_user) {    
        if(searchTerm) {
            searchTerm = searchTerm.trim();
            searchType = "USER";
            
            userModel.search_users(searchType,searchTerm,req.session.logged_in_id, false, function(err, data) {
                if (err) {
                    res.json({err: err});
                } else if (data) {
                    let names = data.map((user) => user.name);
                    res.json(JSON.stringify(names.slice(0, 10)));     	
                }
            });   
        }
    }
}

// Function to get news suggestions, not the full page
var getNewsSearchResultsSuggestions = function(req, res) {
	var searchTerm = req.query.searchTerm; // search for news

	if (req.session.logged_in_user) {    
        if(searchTerm) {
            searchTerm = searchTerm.trim();
            searchType = "NEWS";
            
            userModel.search_users(searchType,searchTerm,req.session.logged_in_id, false, function(err, data) {
                if (err) {
                    res.json({err: err});
                } else if (data) {
                    let headlines = data.map((news) => news.headline);
                    res.json(JSON.stringify(headlines.slice(0, 10)));       	
                }
            });   
        }
    }
}

// Function to get the Visualizer page
var getVisualizerPage = function(req, res) {
    if (req.session.logged_in_user) {
        res.render('main/visualizer.ejs');
    } else {
        res.redirect("/login");
    }
}

// Function to get the page for the chatroom
var getChatRoomPage = function(req, res) {
    if (req.session.logged_in_user && req.query.id) {
        chat_membership_model.get_membership(req.query.id, req.session.logged_in_id,
            function(err, data) {
                if (err) {
                    res.redirect('/')
                } else if (data === 'Member') {
                    res.render('main/chatroom.ejs');
                } else {
                    console.log(data)
                    res.redirect('/')
                }
            }
        )
    } else if (!req.session.logged_in_user) {
        res.redirect('/login')
    } else {
        res.redirect('/')
    }
}

/* 
 * Components
 */
var getHeaderComponent = function(req, res) {
    res.render('components/header.ejs');
}


// Create routes for app.js
var routes = { 
    get_login_page: getLoginPage,
    get_register_page: getRegisterPage,

    get_home_page: getHomePage,
    get_profile_page: getProfilePage,
    get_other_profile_page: getOtherProfilePage,
    get_chat_page: getChatPage,
    get_settings_page: getSettingsPage,
    get_user_search_results_page: getUserSearchResultsPage,
    get_news_search_results_page: getNewsSearchResultsPage,
    get_visualizer_page: getVisualizerPage,

    get_chatroom_page: getChatRoomPage,

    get_news_search_results_suggestions: getNewsSearchResultsSuggestions,
    get_user_search_results_suggestions: getUserSearchResultsSuggestions,

    get_header_component: getHeaderComponent,
};
  
module.exports = routes;