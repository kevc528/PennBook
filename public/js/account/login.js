$( document ).ready(function() {
    initLoginForm();
});

/**
 * Initialize the form for logging in
 */
function initLoginForm() {
    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        $.post('/api/users/checklogin', $('#login-form').serialize(), function(data) {
            console.log(data);
            if (data.success) {
                window.location.replace("/");
            } else {
                $('#error-alert').html(data.err);
                $('#error-alert').show();
            }
        }, 'json');
    });
}
