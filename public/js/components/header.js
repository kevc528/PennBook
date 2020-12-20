
$(document).ready(function() {
    $.getJSON("/api/users/getloggedin", function(data) {
        if (data.success) {
            loadHeader(window.location.pathname, data.data.username);
        } else {
            loadGuestHeader(window.location.pathname);
        }
    });
});

function loadHeader(current_path, username) {
    $("body").prepend("<header id='navHeader'></header>");
    $("#navHeader").load("/components/header #globalHeader", function() {
        if (current_path === "/") {
            $('#home-nav-btn').addClass('active');
        } else if (current_path === "/profile") {
            $('#profile-nav-btn').addClass('active');
        } else if (current_path === "/visualizer") {
            $('#visualizer-nav-btn').addClass('active');
        }
        initAutocomplete();
        initRefreshAutocomplete("user");
        initRefreshAutocomplete("news");

        loadChatInvites(username)
        $("#logout-button").click(() => {
            $.get("/api/users/logout", function() {
                sessionStorage.clear()
                window.location.replace("/login")
            })
        })
    });
}

function loadGuestHeader(current_path) {
    $("body").prepend("<header id='navHeader'></header>");
    $("#navHeader").load("/components/header #guestHeader", function() {
        // console.log(current_path);
    });
}

function jqueryLoadChatInvites(invites, username) {
    if (invites.length) {
        invites.forEach(info => {
            $("#chat-invite-list").append(`
                <li class='dropdown-item' id=${info[1]}>
                    <a>${info[0]} has invited you to chat</a>
                    <button class='accept-invite'>Accept</button>
                    <button class='reject-invite'>Reject</button>
                </li>
            `)
        })
    } else {
        $("#chat-invite-list").append(`
            <li id='no-chat-invites' class='dropdown-item'>No chat invites!</li>
        `)
    }
    $('#chat-invite-list').on('click', '.accept-invite', function() {
        let chatId = $(this).parent().attr('id')
        $.ajax({
            url: '/api/chat-memberships/acceptinvite',
            type: 'PATCH',
            data: {chatId: chatId},
            success: function(response) {
                if (response.success) {
                    $(`#${chatId}`).remove()
                    let chatInvites = JSON.parse(sessionStorage.getItem('chat-invites'))
                    chatInvites = chatInvites.filter(x => x[1] !== chatId)
                    sessionStorage.setItem('chat-invites', JSON.stringify(chatInvites));
                    if (chatInvites.length === 0) {
                        $("#chat-invite-list").append(`
                            <li id='no-chat-invites' class='dropdown-item'>No chat invites!</li>
                        `)
                    }
                    socket.emit('chat accept', chatId, username)
                    window.location.href = `/chatroom?id=${chatId}`
                } else {
                    console.log(response.error)
                    alert("An error occurred while accepting this invite.");
                }
            }
        });    
    })
    $('#chat-invite-list').on('click', '.reject-invite', function() {
        let chatId = $(this).parent().attr('id')
        $.ajax({
            url: '/api/chat-memberships/delete',
            type: 'DELETE',
            data: {chatId: chatId},
            success: function(response) {
                if (response.success) {
                    $(`#${chatId}`).remove()
                    let chatInvites = JSON.parse(sessionStorage.getItem('chat-invites'))
                    chatInvites = chatInvites.filter(x => x[1] !== chatId)
                    sessionStorage.setItem('chat-invites', JSON.stringify(chatInvites));
                    if (chatInvites.length === 0) {
                        $("#chat-invite-list").append(`
                            <li id='no-chat-invites' class='dropdown-item'>No chat invites!</li>
                        `)
                    }
                    socket.emit('chat reject', chatId, username)
                } else {
                    console.log(response.error)
                    alert("An error occurred while removing this invite.");
                }
            }
        });
    })
}

function loadChatInvites(username) {
    let invitesString = sessionStorage.getItem('chat-invites');
    let invites = [];
    if (invitesString) {
        invites = invitesString ? JSON.parse(invitesString) : [];
        jqueryLoadChatInvites(invites, username)
    } else {
        $.getJSON('/api/chat-memberships/getinvites', function(res) {
            if (res.success) {
                invites = res.data.map(val => [val.inviter, val.chatId])
                jqueryLoadChatInvites(invites, username)
            } else {
                console.log(response.error)
                alert("An error occurred while accepting this invite.");
            }
            sessionStorage.setItem('chat-invites', JSON.stringify(invites));
        })
    }
}

function initAutocomplete() {
    $("#userSearchTerm").autocomplete({
        source: []
    });
    $("#newsSearchTerm").autocomplete({
        source: []
    });
}

function initRefreshAutocomplete(searchType) {
    let inp, path, arr;
    
    if (searchType == "user") {
        inp = $("#userSearchTerm")
        path = '/api/users/suggestions';
    } else if (searchType == "news") {
        inp = $("#newsSearchTerm")
        path = '/api/news/suggestions';
    }
    inp[0].addEventListener("input", function(e) {
        val = this.value.toLowerCase().trim();
        $.getJSON(path, {searchTerm: val}, function(data) {
            arr = JSON.parse(data);
            inp.autocomplete({
                source: arr
            });
        })
    })
}