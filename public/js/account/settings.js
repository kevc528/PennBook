src="//ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"

$( document ).ready(function() {
    initInterestsField();
    initUpdateAccountForm();
});

/**
 * Initialize tokenfield for choosing interests
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
 * Initialize form for all possible updates a user can make
 */
function initUpdateAccountForm() {
    $('#update-account-form').submit(function(e) {
        e.preventDefault();
        
        $.ajax({
            url: '/api/users/update',
            type: 'PATCH',
            data: {
                name: $('#name').val(), 
                username: $('#username').val(), 
                email: $('#email').val(), 
                password: $('#password').val(),        
                affiliation: $('#affiliation').val(), 
                birthday: $('#birthday').val(),
                interests: $('#interestsfield').tokenfield('getTokens').map(x => x.value)
            },
            success: function(data) {
                if (data.success) {
                    alert("Your profile has been updated!");
                    window.location.href = "/profile";
                } else {
                    console.log(data.err);
                    $('#error-alert').html(data.err);
                    $('#error-alert').show();
                }
            }
        });
    });
}

/**
 * Unfinished- though this would be a great addition for the future!
 */
function uploadProfilePicture() {
	  var x = document.getElementById("profilePic");
	  console.log(x.name);
}
