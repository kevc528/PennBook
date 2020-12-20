$(function () {
    const urlParams = new URLSearchParams(window.location.search)
    const chatId = urlParams.get('id')
    
    var socket = io.connect(location.protocol + '//' + location.host, {query: `id=${chatId}`});

    let user;
    let allFriends;

    $.when(
        $.getJSON("/api/users/getloggedin", function(item) {
            if (item.success === true) {
                user = item.data.username;
            } else {
                alert("Can't get logged in user")
            }
        })
    ).then(function() {
        $.when(
            $.getJSON(`/api/messages/get?chatId=${chatId}`, function(res) {
                if (res.success) {
                    let messages = res.data.messages.reverse()
                    writeMessages(messages, user)
                    $('#send-form').css('visibility', 'visible');
                } else {
                    alert('Error retrieving messages')
                }
            })
        ).then(function() {
            // Upon a user submitting a message
            $('#send-form').submit(function(e){
                e.preventDefault(); // Prevent page reload
                $.post('/api/messages/send', 
                    {
                        'chatId': chatId,
                        'content': $('#m').val()
                    },
                    function(res) {
                        if (!res.success) {
                            alert('An error has occured sending the message')
                        }
                    }
                )
                socket.emit('chat message', $('#m').val(), chatId, user, new Date().toString());
                $('#m').val('');
                return false;
            })
        
            // Socket Functionalities
            socket.on('chat message', function(msg, username, datetime){
                if (username === user) {
                    $('#messages').append($(`<li class="box-me sb-me" title="${datetime}">`).text(msg))
                } else {
                    $('#messages').append($(`<li class="box-other sb-other" title="${datetime}">`).text(msg));
                    $('#messages').append($('<li class="author">').text(username));
                }
                if (user === username) {
                    window.scrollTo(0, document.body.scrollHeight);
                }
            });

            socket.on('chat invite', function(username) {
                $('#friend-list').append($(`
                    <li class="chat-member" id="${username}">
                        <a href="/user?username=${username}">${username} (invited)</a>
                    </li>
                `))
            })
    
            socket.on('accept invite', function(username) {
                $('#messages').append($('<li class="event">').text(`${username} has joined the chat`));
                $(`#${username}`).html(`
                    <a href="/user?username=${username}">${username}</a>
                `)
            })
    
            socket.on('reject invite', function(username) {
                $('#messages').append($('<li class="event">').text(`${username} has declined their invite`));
                $(`#${username}`).remove()
            })

            socket.on('chat leave', function(username) {
                $('#messages').append($('<li class="event">').text(`${username} has left the chat`));
                $(`#${username}`).remove()
            })
        })

        $.getJSON(`/api/friends/getall?username=${user}`, function(res) {
            if (res.success) {
                allFriends = res.data.online.concat(res.data.offline)
                loadChatInfo(chatId, user, allFriends)
            } else {
                alert('Could not get all your friends')
            }
        })

        prepareChatLeaveButton(user, chatId)

    })
});

/**
 * Initializes the button to let a user permanently leave the chat
 */
var prepareChatLeaveButton = function(user, chatId) {
    $('#leaveChatButton').on('click', function() {
        $.ajax({
            url: '/api/chat-memberships/delete',
            type: 'DELETE',
            data: {chatId: chatId},
            success: function(res) {
                if (res.success) {
                    window.location.href = "/"
                    socket.emit('chat leave', chatId, user)
                } else {
                    alert('Error leaving chat')
                }
            }
        })
    })
} 

/**
 * Initializes the button to make a popup that allows users to invite more friends to chat with
 */
var prepareChatInviteForm = function(user, currentMembers, chatId, allFriends) {
    let uninvitedFriends = allFriends.filter(x => !currentMembers.includes(x))
    $('#invitesfield').tokenfield({
        autocomplete: {
            source: uninvitedFriends,
            delay: 20
        },
        showAutocompleteOnFocus: true
    })
    $('#invitesfield').on('tokenfield:createtoken', function(event) {
        if (!allFriends.includes(event.attrs.value)) {
            event.preventDefault();
            alert('You can only invite your friends!')
        }
    })

    $('#send-invite-form').submit(function(e) {
        e.preventDefault();
        let invitees = $('#invitesfield').tokenfield('getTokens').map(x => x.value);

        let dups = [];
        dups = invitees.filter((item, index) => invitees.indexOf(item) != index);
        if (dups.length) {
            alert("You cannot include the same user twice!");
        } else {
            invitees.forEach(invitee => {           
                $.post('/api/chat-memberships/invite', 
                    {
                        'username': invitee,
                        'chatId': chatId
                    },
                    function(res) {
                        if (!res.success) {
                            alert(res.err)
                        } else {
                            socket.emit('chat invite', user, invitee, chatId)
                        }
                    }
                )
            })
            $('#sendInviteModal').modal('hide'); 
        }
        
    });

    $('#sendInviteModal').on('hidden.bs.modal', function(e) {
        $(this).find("input").val('');
        $('#invitesfield').tokenfield('setTokens', [])
    })
}

/**
 * Loads the information for the chat (name, members)
 */
var loadChatInfo = function(chatId, user, allFriends) {
    $.getJSON(`/api/chats/get?chatId=${chatId}`, function(res) {
        if (res.success) {
            if (res.data.type) {
                $('#chat-name').html(res.data.name)
                $('#chat-btn-group').show()
            } else {
                let otherPrivateUser = res.data.members.find(x => x.username !== user)
                $('#chat-name').html(otherPrivateUser.username)
            }
            $('#members-header').show()
            prepareChatInviteForm(user, res.data.members.map(x => x.username), chatId, allFriends)
            res.data.members.forEach(member => {
                console.log(member)
                let status;
                if (member.accepted) {
                    status = ''
                } else if (!member.accepted && !member.denied) {
                    status = ' (invited)'
                } else if (member.denied) {
                    status = ' (declined)'
                }
                $('#friend-list').append($(`
                    <li class="chat-member" id="${member.username}">
                        <a href="/user?username=${member.username}">${member.username + status}</a>
                    </li>
                `))
            })
        } else {
            alert('Error loading chats')
        }
    })
}

/**
 * Writes the existing messages, or new messages, into the chat
 * Also displays when a user joins or leaves the chat, or declines invites
 */
var writeMessages = function(messages, currentUser) {
    messages.forEach(message => {
        if (message.type === 0) {
            // message
            if (message.author === currentUser) {
                $('#messages').append($(`<li class="box-me sb-me" title="${new Date(message.datetime).toString()}">`).text(message.content));
            } else {
                $('#messages').append($(`<li class="box-other sb-other" title="${new Date(message.datetime).toString()}">`).text(message.content));
                $('#messages').append($('<li class="author">').text(message.author));
            }
        } else if (message.type === 1) {
            // join
            $('#messages').append($('<li class="event">').text(`${message.author} has joined the chat`));
        } else if (message.type === 2) {
            // decline
            $('#messages').append($('<li class="event">').text(`${message.author} has declined their invite`));
        } else if (message.type === 3) {
            // leave chat - for group chats
            $('#messages').append($('<li class="event">').text(`${message.author} has left the chat`));
        }
    })
    window.scrollTo(0, document.body.scrollHeight);
}
