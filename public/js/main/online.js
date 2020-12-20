// This file keeps track of which users are online

// WebSocket handlers - load in for all pages
var socket = io();

$(function () {
    socket.on("chat invite", (inviter, chatId) => {
        let invitesString = sessionStorage.getItem('chat-invites');
        let invites = invitesString ? JSON.parse(invitesString) : [];
        if (!invites.length) {
            $("#no-chat-invites").remove()
        }
        $("#chat-invite-list").prepend(`
            <li class='dropdown-item' id='${chatId}'>
                <a>${inviter} has invited you to chat</a>
                <button class='accept-invite'>Accept</button>
                <button class='reject-invite'>Reject</button>
            </li>
        `)
        let audio = new Audio('/public/media/notification.mp3')
        audio.muted = false;
        setTimeout(audio.play(), 500)
        invites.unshift([inviter, chatId])
        sessionStorage.setItem('chat-invites', JSON.stringify(invites));
    })

    // Set logged in user as active
    $.getJSON('/api/users/getloggedin', function (result) {
        if (result.success) {
            socket.emit("active", result.data.username, window.location.pathname);
        } else {
            console.log("Could not get logged in user: " + result);
        }
    })

});
