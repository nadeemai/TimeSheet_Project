/**
 * User API Service - For getting current user information
 */
@impl: './user-api.js'
service UserAPIService {
    
    // Get current authenticated user info
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