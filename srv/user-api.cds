
@impl: './user-api.js'
service UserAPIService @(requires: 'authenticated-user') {
    
    function getCurrentUser() returns {
        id: String;
        employeeID: String;
        firstName: String;
        lastName: String;
        email: String;
        role: String;
        scopes: array of String;
        authenticated: Boolean;
        employeeFound: Boolean;
    };
    
}