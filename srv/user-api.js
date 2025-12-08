const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {

    this.on('getCurrentUser', async (req) => {
        const user = req.user;

        const usera = req.user.id;

        if (!user || !user.id) {
            return req.error(401, 'User not authenticated');
        }

        let employee = null;

        employee = await SELECT.one.from('my.timesheet.Employees')
            .where({ ID: user.id, isActive: true });

        if (!employee) {
            employee = await SELECT.one.from('my.timesheet.Employees')
                .where({ email: `${user.id}@sumodigitech.com`, isActive: true });

            if (!employee) {
                const employees = await SELECT.from('my.timesheet.Employees')
                    .where({ isActive: true });

                employee = employees.find(emp =>
                    emp.email && emp.email.toLowerCase().startsWith(user.id.toLowerCase())
                );
            }
        }

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

        let roleName = 'Employee';
        if (employee.userRole_ID) {
            const role = await SELECT.one.from('my.timesheet.UserRoles')
                .where({ ID: employee.userRole_ID });
            if (role) {
                roleName = role.roleName;
            }
        }

        return {
            id: employee.ID,  
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