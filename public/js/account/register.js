src="//ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"

$( document ).ready(function() {
    initRegisterForm();
    initCreateAccountForm();
    initBackButton();
    initInterestsField();
});

var randNums = [];

/**
 * Initialize tokenfield to obtain all interests
 */
function initInterestsField() {
    $('#interestsfield').tokenfield({
        autocomplete: {
          source: ['Politics','Wellness','Entertainment','Travel','Style & Beauty','Parenting','Healthy Living','Queer Voices','Food & Drink',
                  'Business', 'Comedy', 'Sports', 'Black Voices', 'Home & Living', 'Parents', 'The WorldPost', 'Weddings', 'Women', 'Impact', 
                  'Divorce', 'Crime', 'Media', 'Weird News', 'Green', 'Worldpost', 'Religion', 'Style', 'Science', 'World News', 'Taste', 
                  'Tech', 'Money', 'Arts', 'Fifty', 'Good News', 'Arts & Culture', 'Environment', 'College', 'Latino Voices', 'Culture & Arts', 'Education'],
          delay: 20
        },
        showAutocompleteOnFocus: true
    })
}

/**
 * Initialize form after register button
 */
function initRegisterForm() {
    $('#first-register-form').on('submit', function(e) {
        e.preventDefault();
        $.post('/api/users/checkfirstregistrationstep', $('#first-register-form').serialize(), function(data) {
            console.log(JSON.stringify(data));
            if (data.success) {
                $('#register-card').hide();
                $('#tellmore-card').show();
                $('.error-alert').hide();
            } else {
                $('.error-alert').html(data.err);
                $('.error-alert').show();
            }
        }, 'json');
    });
}

/**
 * Initialize form to create an account
 */
function initCreateAccountForm() {
    $('#second-register-form').on('submit', function(e) {
        e.preventDefault();
    	var userid=Math.floor((Math.random() * 100) + 54);

        $.post('/api/users/create', { 
                name: $('#name').val(), 
                username: $('#username').val(), 
                email: $('#email').val(), 
                password: $('#password').val(),        
                confirmpassword: $('#confirmpassword').val(), 
                affiliation: $('#affiliation').val(), 
                birthday: $('#birthday').val(),
                interests: $('#interestsfield').tokenfield('getTokens').map(x => x.value),
                verfied: userid,

            },
            
            function(data) {
            if (data.success) {
                var from,to,subject,text;
                to=$("#email").val(); 
              
                $.get(
                    "/send",
                    {to:to, userid:userid},
                    function(){
                });
                alert("A verification email has been sent to you.");   
                window.location.replace("/login");
            } else {
                $('.error-alert').html(data.err);
                $('.error-alert').show();
            }
        }, 'json');
        
 
    });
}

/**
 * Returns back to the first registration form
 */
function initBackButton() {
    $('#back-button').click(function() {
        $('#tellmore-card').hide();
        $('#register-card').show();
    });
}
