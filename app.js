var express = require('express');
var session = require('express-session');
const cron = require('node-cron')

var nodemailer = require("nodemailer");
const { body, query, validationResult } = require('express-validator');
var cors = require('cors');
var bodyParser = require('body-parser');
var validator = require('validator');



var app = express()
app.use(bodyParser.json())
app.use(express.urlencoded())
app.use(session({secret: 'secret'}))
app.use('/public', express.static(__dirname + '/public'))
app.use(cors())

var user_routes = require('./routes/user_routes');
var friend_routes = require('./routes/friend_routes');
var post_routes = require('./routes/post_routes');
var page_routes = require('./routes/page_routes');
var vis_routes = require('./routes/vis_routes');
const comment_routes = require('./routes/comment_routes');
const chat_routes = require('./routes/chat_routes');
const chat_membership_routes = require('./routes/chat_membership_routes')
const message_routes = require('./routes/message_routes');
const news_model = require('./models/news_model');

var http = require('http').createServer(app);
var io = require('socket.io')(http);


// Create map of online usernames and their clients
const userSocketIdMap = new Map(); 

let onlineDebug = false;


function getOnlineUsers() {
    return [...userSocketIdMap.keys()];
}
module.exports.getOnlineUsers = getOnlineUsers;

io.on('connection', function (socket) {
    let chatId = socket.handshake.query['id'];

    if (chatId) {
        console.log('CHAT ID:', chatId)
        socket.join(chatId)
    }

    socket.on('active', (username, path) => {
        if (username) {
            addClientToMap(username, socket.id);
            if (onlineDebug) {
                console.log(userSocketIdMap);
                console.log(username + " is active on page " + path);
            }
            
        }
    });

    socket.on('disconnect', () => {
        removeClientFromMap(socket.id);
        if (onlineDebug) {
            console.log(userSocketIdMap);
        }
    });
    
    socket.on('chat message', (msg, chatId, user, datetime) => {
        io.to(chatId).emit('chat message', msg, user, datetime);
    });

    socket.on('chat invite', (inviter, invitee, chatId) => {
        io.to(chatId).emit('chat invite', invitee);
        let inviteeSockets = userSocketIdMap.get(invitee)
        if (inviteeSockets) {
            inviteeSockets.forEach(socketId => {
                socket.to(socketId).emit('chat invite', inviter, chatId)
            })
        }
    })

    socket.on('chat accept', (chatId, user) => {
        io.to(chatId).emit('accept invite', user)
    })

    socket.on('chat reject', (chatId, user) => {
        io.to(chatId).emit('reject invite', user)
    })

    socket.on('chat leave', (chatId, user) => {
        io.to(chatId).emit('chat leave', user)
    })

});

function addClientToMap(username, socketId) {
    if (!userSocketIdMap.has(username)) {
        // When user is joining first time
        userSocketIdMap.set(username, new Set([socketId]));
    } else {
        // User had already joined from one client and now joining using another client
        userSocketIdMap.get(username).add(socketId);
    }
}

function removeClientFromMap(socketId) {
    let username;
    for (let [key, value] of userSocketIdMap.entries()) {
        if (value.has(socketId)) {
            username = key;
            break;
        }
    }
    if (username) {
        let userSocketIdSet = userSocketIdMap.get(username);
        userSocketIdSet.delete(socketId);
        // If there are no clients for a user, remove that user from online list (map)
        if (userSocketIdSet.size == 0) {
            userSocketIdMap.delete(username);
            if (onlineDebug) {
                console.log(username + " completely disconnected");
            }
        } else {
            if (onlineDebug) {
                console.log(username + " disconnected, but is still connected on another client");
            }
        }
    }
}

// NOTE: if you need a job to run immediately, change the cron.schedule
// crontab.guru is a good site to check out if you don't know the cron expressions

// hourly cron job for running recommendations spark job
cron.schedule('0 * * * *', function() {
    console.log('hourly run of spark cron job - everytime minute is 0');
    news_model.call_recommend_job(news_model.JOB_TYPE.HOURLY)
});  

// daily cron job for running full spark job (recs + adsoprtion weights)
cron.schedule('0 0 * * *', function() {
    console.log('run full spark job with edge weights - once a day at midnight');
    news_model.call_full_job()
})

// Routes for email verification  
app.get('/send', user_routes.sendEmail);
app.get('/verify', user_routes.verify);

// POST request with username and password pair, checks if username is taken
app.post('/api/users/checkfirstregistrationstep', [
    body('name')
        .trim()
        .isLength({min:1}).withMessage('Please enter your full name.')
        .custom(value => /\s/.test(value)).withMessage('Please enter both your first and last name.'),
    body('username')
        .custom(value => !/\s/.test(value)).withMessage('No spaces are allowed in the username.')
        .isLength({min:1}).withMessage('Please enter a username.')
        .isLength({min:3}).withMessage('Your username must be at least 3 characters.'),
    body('email')
        .isLength({min:1}).withMessage('Please enter your email address.')
        .isEmail().withMessage('Please enter a valid email address.'),
    body('password')
        .isLength({min:1}).withMessage('Please enter a password.')
        .isLength({min:6}).withMessage('Your password must be at least 6 characters.'),
    body('confirmpassword')
        .isLength({min:1}).withMessage('Please confirm your password by entering it again.')
        .custom((value, {req}) => value === req.body.password).withMessage('The passwords you entered do not match.')
], user_routes.check_first_registration_step)

// POST request with user profile information to create a profile - interests is optional
// Will set the logged_in_user and logged_in_id in the session correctly
app.post('/api/users/create', [
    // Validate previous info in case user somehow edits previous form
    body('name')
        .trim()
        .isLength({min:1}).withMessage('Please enter your full name.')
        .custom(value => /\s/.test(value)).withMessage('Please enter both your first and last name.'),
    body('username')
        .custom(value => !/\s/.test(value)).withMessage('No spaces are allowed in the username.')
        .isLength({min:1}).withMessage('Please enter a username.')
        .isLength({min:3}).withMessage('Your username must be at least 3 characters.'),
    body('password')
        .isLength({min:1}).withMessage('Please enter a password.')
        .isLength({min:6}).withMessage('Your password must be at least 6 characters.'),
    body('confirmpassword')
        .isLength({min:1}).withMessage('Please confirm your password by entering it again.')
        .custom((value, {req}) => value === req.body.password).withMessage('The passwords you entered do not match.'),
    body('email')
        .isLength({min:1}).withMessage('Please enter your email address.')
        .isEmail().withMessage('Please enter a valid email address.'),
    body('birthday')
        .isLength({min:1}).withMessage('Please enter your date of birth.')
        .isDate().withMessage('Please enter a valid birthday.'),
    body('interests')
        .custom(interests => Array.isArray(interests) && interests.length >= 2).withMessage('Please input at least two interests.'),
    body('affiliation').isIn(['SEAS', 'WH', 'CAS', 'NURS', '']).withMessage('Affiliation not correct.'),
], user_routes.create_account)

// POST request with username and password pair to check login
// Will set the logged_in_user and logged_in_id in the session correctly
app.post('/api/users/checklogin', [
    body('username').isLength({min:1}).withMessage('Please enter your username.'),
    body('password').isLength({min:1}).withMessage('Please enter your password.')
], user_routes.check_login)

// PATCH route that will update the profile of a user - you only need to include the user
// fields that NEED to be updated
app.patch('/api/users/update', [
    body('name')
        .optional({nullable: true, checkFalsy: true})
        .custom(value => /\s/.test(value)).withMessage('Please enter both your first and last name.'),
    body('username')
        .optional({nullable: true, checkFalsy: true})
        .custom(value => !/\s/.test(value)).withMessage('No spaces are allowed in the username.')
        .isLength({min:3}).withMessage('Your username must be at least 3 characters.'),
    body('password')
        .optional({nullable: true, checkFalsy: true})
        .isLength({min:6}).withMessage('Your password must be at least 6 characters.'),
    body('email')
        .optional({nullable: true, checkFalsy: true})
        .isEmail().withMessage('Please enter a valid email address.'),
    body('birthday')
        .optional({nullable: true, checkFalsy: true})
        .isDate().withMessage('Please enter a valid birthday.'),
    body('interests')
        .optional({nullable: true, checkFalsy: true})
        .custom(interests => Array.isArray(interests) && interests.length >= 2).withMessage('Please input at least two interests.'),
    body('affiliation')
        .optional({nullable: true, checkFalsy: true}).custom(val => {
        if (!(['SEAS', 'CAS', 'WH', 'NURS', 'Select your affiliation (optional)'].includes(val))) {
            throw new Error("Invalid Affiliation");
        }
        return true;
    }),
], user_routes.update_account)

// GET route to logout
app.get('/api/users/logout', user_routes.logout)

// GET route for getting profile info of the logged in user
app.get('/api/users/getloggedin', user_routes.get_logged_in_account);

// GET route for the profile of a given user
app.get('/api/users/profile', [
    query('username').isLength({min:1})
], user_routes.get_user_profile)


/* Main Functionality Routes */
app.get('/', page_routes.get_home_page);
app.get('/profile', page_routes.get_profile_page);
app.get('/user', page_routes.get_other_profile_page);
app.get('/chat', page_routes.get_chat_page);
app.get('/usersearchresults', page_routes.get_user_search_results_page);
app.get('/newssearchresults', page_routes.get_news_search_results_page);
app.get('/settings', page_routes.get_settings_page);
app.get('/visualizer', page_routes.get_visualizer_page);

/* For search suggestions */
app.get('/api/users/suggestions', page_routes.get_user_search_results_suggestions);
app.get('/api/news/suggestions', page_routes.get_news_search_results_suggestions);


// Temporary
app.get('/chatroom', page_routes.get_chatroom_page);

/* Account Routes */
app.get('/login', page_routes.get_login_page);
app.get('/register', page_routes.get_register_page);

/* Component Routes */
app.get('/components/header', page_routes.get_header_component);

// GET route for getting the friends of a specific user
app.get('/api/friends/getall', friend_routes.get_friends)

// GET route for getting all pending friend requests of a specific user
app.get('/api/friends/getrequests', friend_routes.get_friend_requests)

// POST route to create a new friend request - request body requires a username for friend
app.post('/api/friends/request', [
    body('username').isLength({min:1})
], friend_routes.send_friend_request)

// GET route to get friendship status between logged in user and specified user in query
app.get('/api/friends/status', [
    query('username').isLength({min:1})
], friend_routes.get_friend_status)

// PATCH route to get accept a friendship request
app.patch('/api/friends/accept', [
    body('username').isLength({min:1})
], friend_routes.accept_request)

// DELETE route to delete a friendship with current user and signed in user
app.delete('/api/friends/delete', [
    body('username').isLength({min:1})
], friend_routes.delete_friend)

// POST request for posting on a user's wall
app.post('/api/posts/create', [
    body('username').isLength({min:1}).withMessage('Username is required'),
    body('content').isLength({min:1}).withMessage("Post can't be empty")
], post_routes.post_on_wall)

// DELETE route to delete a post using ID - user can delete their own posts or any post on their wall
app.delete('/api/posts/delete', [
    body('id').isLength({min:1}),
], post_routes.delete_user_post)

// UPDATE route to update a post using ID - only authors can update
app.patch('/api/posts/update', [
    body('id').isLength({min:1}),
    body('content').isLength({min:1})
], post_routes.update_user_post)

// UPDATE route to update a news rec - only user with news rec can update
app.patch('/api/posts/likeunlikenews', [
    body('id').isLength({min:1}),
    body('link').isLength({min:1})
], post_routes.like_or_unlike_news_post)

/**
 * GET route to get the wall for a specified username in query params
 * will return something called LastEvaluatedKey if there are more items to load - you want to save this 
 * on the frontend for lazy loading and put the fields as query params when calling this function to get the 
 * next posts
 * i.e. /api/post/getall?user=username will get the first few posts
 * /api/posts/getwall?username=kevin&startId=<id_from_last_evaluated_key>&startDatetime=<datetime_from_last_evaluated_key>
 */
app.get('/api/posts/getwall', [
    query('username').isLength({min:1})
], post_routes.get_wall)

// To use on main feed; give date to get before/after
app.get('/api/posts/getwalloffriends', [
], post_routes.get_wall_of_friends)

app.post('/api/comments/create', [
    body('postId').isLength({min:1}),
    body('content').isLength({min:1})
], comment_routes.post_comment)

/**
 * GET route to get the comments for a specific post
 * Similar logic with the last evaluated key as the getwall route - pass in startDatetime as a query param 
 * if you need to get older comments
 */
app.get('/api/comments/get', [
    query('postId').isLength({min:1})
], comment_routes.get_comments)


/**
 * POST route to create a new named chat - will automatically create a membership for the logged in user
 * TO CREATE PRIVATE CHAT - include type = 0, users = [otherUsername]
 * TO CREATE GROUP CHAT - include type = 1, name = "NAME", users = [all invited usernames]
 */
app.post('/api/chats/create', [
    body('type').isIn(['0', '1']),
    body('name').custom((value, {req}) => {
        if (req.body.type == 0) {
            return true
        } else {
            let trimmed = value.trim()
            return trimmed.length > 0
        }
    }).withMessage('Please give a name for the chat'),
    body('users').custom(users => Array.isArray(users) && users.length >= 1).withMessage('Please select at least 1 friend to chat with.'),
], chat_routes.create_chat)

app.get('/api/chats/get', [
    query('chatId').isLength({min:1})
], chat_routes.get_chat)

/**
 * Checks if private chat with user already exists
 */
app.get('/api/chats/getprivate', [
    query('username').isLength({min:1})
], chat_routes.get_private_chat)

/**
 * Used if previously invited - but rejected previously
 */
app.post('/api/chat-memberships/joinprivate', [
    body('chatId').isLength({min:1})
], chat_membership_routes.join_private_chat)

/**
 * GET route to get the membership of the current logged in user in a given chat
 */
app.get('/api/chat-memberships/get', [
    query('chatId').isLength({min:1})
], chat_membership_routes.get_membership)

/**
 * POST route for sending an invite to a specified user
 */
app.post('/api/chat-memberships/invite', [
    body('username').isLength({min:1}),
    body('chatId').isLength({min:1}) 
], chat_membership_routes.create_invite)

/**
 * PATCH route for when the user accepts an invite to a chat
 */
app.patch('/api/chat-memberships/acceptinvite', [
    body('chatId').isLength({min:1})
], chat_membership_routes.accept_chat_invite)

/**
 * DELETE for deleting a membership in the chat membership table - used for rejecting invites 
 * and leaving groups
 */
app.delete('/api/chat-memberships/delete', [
    body('chatId').isLength({min:1})
], chat_membership_routes.delete_membership)

/**
 * GET route for getting all the chats the logged in user is part of
 */
app.get('/api/chat-memberships/getall', chat_membership_routes.get_user_chats)

/**
 * GET route for getting all the invites for the logged in user
 */
app.get('/api/chat-memberships/getinvites', chat_membership_routes.get_user_invites)

/**
 * POST route used to store a message that has been sent in the database
 */
app.post('/api/messages/send', [
    body('chatId').isLength({min:1}),
    body('content').isLength({min:1})
], message_routes.send_message)

/**
 * GET route used to get the messages in a chat given by query params
 * Similar logic with the last evaluated key as the getwall route - pass in startDatetime as a query param 
 * if you need to get older messages in a chat
 * NOTE THAT MESSAGES HAVE TYPES - 0 is normal text message, 1 - is the author joined a chat, 2 - is the author 
 * declined their invitation, 3 - is the author left the chat
 */
app.get('/api/messages/get', [
    query('chatId').isLength({min:1})
], message_routes.get_messages_in_chat)

/*
 * GET route for getting initial data for friend visualizer
 */
app.get('/friendvisualization', vis_routes.get_friend_visualization)

/**
 * GET route for getting friends of a specific node for friend visualizer
 */
app.get('/getFriends/:user', vis_routes.get_node_children)

http.listen(8080);
console.log('Server running on port 8080. Now open http://localhost:8080/ in your browser!');
console.log('RUN TO CREATE THE TABLES IF DELETED: node scripts/create_tables.js');
