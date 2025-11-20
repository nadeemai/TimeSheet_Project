const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {

    // Endpoint to get current user information
    this.on('getCurrentUser', async (req) => {
        const user = req.user;

        const usera = req.user.id;

        if (!user || !user.id) {
            return req.error(401, 'User not authenticated');
        }

        let employee = null;

        // STRATEGY 1: Try to find by UUID (for production XSUAA)
        employee = await SELECT.one.from('my.timesheet.Employees')
            .where({ ID: user.id, isActive: true });

        // STRATEGY 2: If not found, try username-based lookup (for development)
        if (!employee) {
            // First, try exact email match
            employee = await SELECT.one.from('my.timesheet.Employees')
                .where({ email: `${user.id}@sumodigitech.com`, isActive: true });

            // If still not found, try partial email match
            if (!employee) {
                const employees = await SELECT.from('my.timesheet.Employees')
                    .where({ isActive: true });

                // Find employee where email starts with username
                employee = employees.find(emp =>
                    emp.email && emp.email.toLowerCase().startsWith(user.id.toLowerCase())
                );
            }
        }

        // If employee still not found, return error response
        if (!employee) {
            return {
                id: user.id,
                scopes: user.is('Admin') ? ['Admin'] :
                    user.is('Manager') ? ['Manager'] :
                        user.is('Employee') ? ['Employee'] : [],
                authenticated: true,
                employeeFound: false
            };
        }

        // Get role information
        let roleName = 'Employee';
        if (employee.userRole_ID) {
            const role = await SELECT.one.from('my.timesheet.UserRoles')
                .where({ ID: employee.userRole_ID });
            if (role) {
                roleName = role.roleName;
            }
        }

        // Return employee details
        return {
            id: employee.ID,  // Return employee UUID
            employeeID: employee.employeeID,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            role: roleName,
            scopes: user.is('Admin') ? ['Admin'] :
                user.is('Manager') ? ['Manager'] :
                    user.is('Employee') ? ['Employee'] : [],
            authenticated: true,
            employeeFound: true
        };
    });

});