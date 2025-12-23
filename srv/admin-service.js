const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
    const { Employees, UserRoles, Activities, NonProjectTypes, Projects, Timesheets, Notifications, LeaveTypes, EmployeeLeaveBalance } = this.entities;


    const getAuthenticatedAdmin = async (req) => {
    const userId = req.user.id;
    
    console.log('🔍 Admin Auth - User ID from BTP:', userId);
    console.log('🔍 Admin Auth - User roles:', req.user.attr);
    
    if (!userId) {
        console.log('No user ID found');
        req.error(401, 'User not authenticated');
        return null;
    }

    const hasAdminRole = req.user.is('Admin');
    console.log('Admin Auth - Has Admin role in BTP:', hasAdminRole);
    
    if (!hasAdminRole) {
        console.log('User does not have Admin role in BTP');
        req.error(403, 'Admin role required. Please ensure you are logged in with Admin credentials.');
        return null;
    }

    let admin = await SELECT.one.from('my.timesheet.Employees')
        .where({ email: userId, isActive: true });

    if (!admin && !userId.includes('@')) {
        console.log('⚠️ User ID is not an email, trying with @sumodigitech.com domain...');
        const emailWithDomain = `${userId}@sumodigitech.com`;
        admin = await SELECT.one.from('my.timesheet.Employees')
            .where({ email: emailWithDomain, isActive: true });
    }

    if (!admin) {
        console.log('⚠️ Trying case-insensitive email search...');
        const allEmployees = await SELECT.from('my.timesheet.Employees')
            .where({ isActive: true });
        
        const userEmail = userId.toLowerCase();
        admin = allEmployees.find(emp => 
            emp.email && emp.email.toLowerCase() === userEmail
        );
    }

    if (!admin) {
        console.log(' Admin profile not found in database, but has Admin role in BTP');
        return { 
            ID: userId, 
            isAdmin: true,
            employeeID: 'SYSTEM_ADMIN',
            email: userId
        };
    }

    if (admin.userRole_ID) {
        const role = await SELECT.one.from('my.timesheet.UserRoles')
            .where({ ID: admin.userRole_ID });
            
        console.log('Admin Auth - Database role:', role?.roleName);
        
        if (role && role.roleName !== 'Admin') {
            console.log(' User role in database is not Admin');
            req.error(403, 'Access denied. Admin role required in database.');
            return null;
        }
    }

    console.log('Admin authenticated successfully:', admin.employeeID, 'Email:', admin.email);
    return admin;
};
    this.before('CREATE', 'Employees', async (req) => {
        console.log('Before CREATE Employee - Start validation');
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) {
            console.log(' Admin validation failed for CREATE');
            return req.reject(403, 'Admin access required');
        }
        
        console.log('Admin validation passed for CREATE');
        if (!req.data.employeeID) {
            const count = await SELECT.from(Employees);
            req.data.employeeID = `EMP${String(count.length + 1).padStart(4, '0')}`;
            console.log('🔧 Generated employeeID:', req.data.employeeID);
        }
    });

    this.before(['UPDATE', 'DELETE'], ['Employees', 'UserRoles', 'Activities', 'NonProjectTypes'], async (req) => {
        console.log(' Before UPDATE/DELETE - Start validation');
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) {
            console.log('Admin validation failed for UPDATE/DELETE');
            return req.reject(403, 'Admin access required');
        }
        
        console.log('Admin validation passed for UPDATE/DELETE');
    });


this.on('initializeLeaveTypes', async (req) => {
    console.log('🔧 Initializing Leave Types...');
    
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) return 'Admin authentication failed';

    try {

        const existingLeaveTypes = await SELECT.from('my.timesheet.LeaveTypes');
        
        if (existingLeaveTypes.length > 0) {
            console.log('Leave types already exist:', existingLeaveTypes.length);
            return `Leave types already initialized. Found ${existingLeaveTypes.length} leave types.`;
        }

        const leaveTypesToCreate = [
            {
                leaveTypeID: 'LT001',
                typeName: 'Personal Leave',
                defaultHours: 8,
                description: 'Full day personal leave - 8 hours',
                isActive: true
            },
            {
                leaveTypeID: 'LT002',
                typeName: 'Sick Leave',
                defaultHours: 8,
                description: 'Full day sick leave - 8 hours',
                isActive: true
            },
            
        ];


        await INSERT.into('my.timesheet.LeaveTypes').entries(leaveTypesToCreate);

        console.log('Successfully created 3 leave types');
        
        const createdLeaveTypes = await SELECT.from('my.timesheet.LeaveTypes');
        
        return `Successfully initialized ${createdLeaveTypes.length} leave types: Personal Leave (8hrs), Sick Leave (8hrs)`;
        
    } catch (error) {
        console.error('Error initializing leave types:', error);
        return req.error(500, 'Failed to initialize leave types: ' + error.message);
    }
});

this.on('createEmployee', async (req) => {
    const { employeeID, firstName, lastName, email, managerEmployeeID, roleID } = req.data;

    console.log('createEmployee action called with data:', { employeeID, firstName, lastName, email });
    
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) {
        console.log('createEmployee: Admin authentication failed');
        return 'Admin authentication failed';
    }

    console.log('createEmployee: Admin authenticated');

    let finalEmployeeID = employeeID;
    if (!finalEmployeeID) {
        const count = await SELECT.from(Employees);
        finalEmployeeID = `EMP${String(count.length + 1).padStart(4, '0')}`;
        console.log('🔧 Generated employeeID:', finalEmployeeID);
    }

    const existing = await SELECT.one.from(Employees).where({ employeeID: finalEmployeeID });
    if (existing) {
        return req.error(400, 'Employee ID already exists');
    }

    const existingEmail = await SELECT.one.from(Employees).where({ email });
    if (existingEmail) {
        return req.error(400, 'Email already exists');
    }

    const role = await SELECT.one.from(UserRoles).where({ ID: roleID });
    if (!role) {
        return req.error(404, 'Role not found');
    }

    let manager = null;
    let managerName = null;
    if (managerEmployeeID) {
        manager = await SELECT.one.from(Employees).where({ employeeID: managerEmployeeID });
        if (!manager) {
            return req.error(404, 'Manager not found');
        }
        if (manager.userRole_ID) {
            const managerRole = await SELECT.one.from(UserRoles)
                .where({ ID: manager.userRole_ID });
            
            if (!managerRole || managerRole.roleName !== 'Manager') {
                return req.error(400, 'Selected employee is not a Manager. Please select a valid Manager.');
            }
        }
        managerName = `${manager.firstName} ${manager.lastName}`;
    }

    await INSERT.into(Employees).entries({
        employeeID: finalEmployeeID,
        firstName,
        lastName,
        email,
        isActive: true,
        userRole_ID: roleID,
        managerID_ID: manager ? manager.ID : null
    });

    console.log('✅ Employee created successfully:', finalEmployeeID);

    const newEmployee = await SELECT.one.from(Employees)
        .where({ employeeID: finalEmployeeID });

    if (!newEmployee) {
        console.error('❌ Failed to retrieve employee with ID:', finalEmployeeID);
        return req.error(500, 'Failed to retrieve created employee');
    }

    console.log('✅ Retrieved employee:', newEmployee.ID, newEmployee.employeeID);

    if (role.roleName === 'Employee') {
        try {
            const crypto = require('crypto');
            
            const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
            const ENCRYPTION_IV = process.env.ENCRYPTION_IV || '1234567890123456';
            
            const cipher = crypto.createCipheriv(
                'aes-256-cbc',
                Buffer.from(ENCRYPTION_KEY),
                Buffer.from(ENCRYPTION_IV)
            );
            
            let linkToken = cipher.update(finalEmployeeID, 'utf8', 'hex');
            linkToken += cipher.final('hex');
            
            let dashboardUrl;
            const isProduction = process.env.NODE_ENV === 'production' || process.env.VCAP_SERVICES;
            
            if (isProduction) {
                const launchpadBaseUrl = process.env.LAUNCHPAD_URL || 
                    'https://sydney-2zgrdye7.launchpad.cfapps.ap10.hana.ondemand.com';
                const appId = process.env.EMPLOYEE_APP_ID || 
                    'timesheet-application.employee-0.0.1';
                
                dashboardUrl = `${launchpadBaseUrl}/${appId}/index.html#/OTPVerification/${linkToken}`;
            } else {
                const devBaseUrl = process.env.DASHBOARD_URL_DEV || 'http://localhost:4004/employee';
                
                if (devBaseUrl.includes('index.html')) {
                    dashboardUrl = `${devBaseUrl}#/OTPVerification/${linkToken}`;
                } else {
                    dashboardUrl = `${devBaseUrl}/index.html#/OTPVerification/${linkToken}`;
                }
            }

            console.log('🔗 Generated dashboard URL:', dashboardUrl);
            console.log('🔐 Generated link token:', linkToken);
            console.log('🌍 Environment:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');

            await INSERT.into('my.timesheet.auth.EmployeeDashboardLink').entries({
                employee_ID: newEmployee.ID,
                linkToken: linkToken,
                dashboardUrl: dashboardUrl,
                isActive: true
            });

            console.log('💾 Dashboard link stored in database');

            try {
                const { sendWelcomeEmail } = require('./email_service');
                
                if (sendWelcomeEmail) {
                    const emailResult = await sendWelcomeEmail({
                        employeeName: `${firstName} ${lastName}`,
                        employeeEmail: email,
                        employeeID: finalEmployeeID,
                        dashboardUrl: dashboardUrl,
                        managerName: managerName,
                        linkToken: linkToken
                    });

                    if (emailResult && emailResult.success) {
                        console.log('✅ Welcome email sent successfully to:', email);
                    }
                }
            } catch (emailError) {
                console.warn('⚠️ Email service error:', emailError.message);
            }

            return JSON.stringify({
                success: true,
                message: `Employee ${firstName} ${lastName} (${finalEmployeeID}) created successfully${manager ? ` and assigned to Manager ${manager.firstName} ${manager.lastName}` : ''}.`,
                employee: {
                    employeeID: finalEmployeeID,
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    role: role.roleName,
                    manager: manager ? `${manager.firstName} ${manager.lastName}` : null
                },
                dashboardAccess: {
                    url: dashboardUrl,
                    linkToken: linkToken,
                    instructions: 'Share this URL with the employee. They will receive an OTP via email for verification.'
                }
            }, null, 2);

        } catch (error) {
            console.error('❌ Error creating dashboard link:', error);
            return `Employee ${firstName} ${lastName} (${finalEmployeeID}) created successfully, but failed to generate dashboard link. Error: ${error.message}`;
        }
    } else {
        return `Employee ${firstName} ${lastName} (${finalEmployeeID}) created successfully${manager ? ` and assigned to Manager ${manager.firstName} ${manager.lastName}` : ''}. 

Note: Dashboard links are only generated for Employee role. This user can access the system through the standard ${role.roleName} portal.`;
    }
});

this.on('createRole', async (req) => {
        const { roleID, roleName, description } = req.data;

  
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const existing = await SELECT.one.from(UserRoles).where({ roleID });
        if (existing) {
            return req.error(400, 'Role ID already exists');
        }

        await INSERT.into(UserRoles).entries({
            roleID,
            roleName,
            description
        });

        return `Role ${roleName} created successfully`;
    });

    this.on('createActivity', async (req) => {
        const { activityID, activity, activityType, projectID, isBillable, plannedHours, startDate, endDate } = req.data;

        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const existing = await SELECT.one.from(Activities).where({ activityID });
        if (existing) {
            return req.error(400, 'Activity ID already exists');
        }

        if (!['Project', 'NonProject', 'Mixed'].includes(activityType)) {
            return req.error(400, 'Activity type must be Project, NonProject, or Mixed');
        }
        let project_ID = null;
        if (projectID) {
            const project = await SELECT.one.from(Projects).where({ projectID });
            if (!project) {
                return req.error(404, 'Project not found');
            }
            project_ID = project.ID;
        }

        await INSERT.into(Activities).entries({
            activityID,
            activity,
            activityType,
            project_ID,
            isBillable: isBillable || false,
            plannedHours,
            startDate,
            endDate,
            status: 'Active'
        });

        return `Activity ${activity} created successfully`;
    });

    this.on('updateActivity', async (req) => {
        const { activityID, activity, activityType, projectID, isBillable, plannedHours, startDate, endDate, status } = req.data;

        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const activityRecord = await SELECT.one.from(Activities).where({ activityID });
        if (!activityRecord) {
            return req.error(404, 'Activity not found');
        }
        if (activityType && !['Project', 'NonProject', 'Mixed'].includes(activityType)) {
            return req.error(400, 'Activity type must be Project, NonProject, or Mixed');
        }
        if (status && !['Active', 'Inactive', 'Completed'].includes(status)) {
            return req.error(400, 'Status must be Active, Inactive, or Completed');
        }
        let project_ID = activityRecord.project_ID;
        if (projectID) {
            const project = await SELECT.one.from(Projects).where({ projectID });
            if (!project) {
                return req.error(404, 'Project not found');
            }
            project_ID = project.ID;
        }

        await UPDATE(Activities)
            .set({ 
                activity, 
                activityType, 
                project_ID,
                isBillable, 
                plannedHours, 
                startDate, 
                endDate, 
                status 
            })
            .where({ ID: activityRecord.ID });

        return `Activity ${activity} updated successfully`;
    });

    this.on('createNonProjectType', async (req) => {
        const { nonProjectTypeID, typeName, description, isBillable } = req.data;

        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const existing = await SELECT.one.from(NonProjectTypes).where({ nonProjectTypeID });
        if (existing) {
            return req.error(400, 'Non-Project Type ID already exists');
        }

        await INSERT.into(NonProjectTypes).entries({
            nonProjectTypeID,
            typeName,
            description,
            isBillable: isBillable || false,
            isActive: true
        });

        return `Non-Project Type ${typeName} created successfully`;
    });

    this.on('updateNonProjectType', async (req) => {
        const { nonProjectTypeID, typeName, description, isBillable, isActive } = req.data;

        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const nonProjectType = await SELECT.one.from(NonProjectTypes).where({ nonProjectTypeID });
        if (!nonProjectType) {
            return req.error(404, 'Non-Project Type not found');
        }

        await UPDATE(NonProjectTypes)
            .set({ typeName, description, isBillable, isActive })
            .where({ ID: nonProjectType.ID });

        return `Non-Project Type ${typeName} updated successfully`;
    });

    this.on('createProject', async (req) => {
        const { projectID, projectName, description, startDate, endDate, projectRole, budget, allocatedHours, projectOwnerID, isBillable } = req.data;

        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const existing = await SELECT.one.from(Projects).where({ projectID });
        if (existing) {
            return req.error(400, 'Project ID already exists');
        }

        if (projectRole && !['Designing', 'Developing', 'Testing', 'Deployment'].includes(projectRole)) {
            return req.error(400, 'Project role must be Designing, Developing, Testing, or Deployment');
        }

        let projectOwner_ID = null;
        if (projectOwnerID) {
            const owner = await SELECT.one.from(Employees).where({ employeeID: projectOwnerID });
            if (!owner) {
                return req.error(404, 'Project owner not found');
            }
            projectOwner_ID = owner.ID;
        }

        await INSERT.into(Projects).entries({
            projectID,
            projectName,
            description,
            startDate,
            endDate,
            projectRole,
            budget,
            allocatedHours,
            projectOwner_ID,
            isBillable: isBillable !== false,
            status: 'Active'
        });

        return `Project ${projectName} created successfully`;
    });

    this.on('updateProject', async (req) => {
        const { projectID, projectName, description, projectRole, budget, allocatedHours, status } = req.data;

        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const project = await SELECT.one.from(Projects).where({ projectID });
        if (!project) {
            return req.error(404, 'Project not found');
        }

        if (projectRole && !['Designing', 'Developing', 'Testing', 'Deployment'].includes(projectRole)) {
            return req.error(400, 'Project role must be Designing, Developing, Testing, or Deployment');
        }

        if (status && !['Active', 'Completed', 'On Hold'].includes(status)) {
            return req.error(400, 'Status must be Active, Completed, or On Hold');
        }

        await UPDATE(Projects)
            .set({ projectName, description, projectRole, budget, allocatedHours, status })
            .where({ ID: project.ID });

        return `Project ${projectName} updated successfully`;
    });

    this.on('assignEmployeeToManager', async (req) => {
        const { employeeID, managerEmployeeID } = req.data;


        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const employee = await SELECT.one.from(Employees).where({ employeeID });
        if (!employee) {
            return req.error(404, 'Employee not found');
        }

        const manager = await SELECT.one.from(Employees).where({ employeeID: managerEmployeeID });
        if (!manager) {
            return req.error(404, 'Manager not found');
        }

        if (!manager.isActive) {
            return req.error(400, 'Cannot assign to inactive manager');
        }

        if (manager.userRole_ID) {
            const managerRole = await SELECT.one.from(UserRoles)
                .where({ ID: manager.userRole_ID });
            
            if (!managerRole || managerRole.roleName !== 'Manager') {
                return req.error(400, 'Selected employee is not a Manager. Please select a valid Manager.');
            }
        }

        await UPDATE(Employees).set({ managerID_ID: manager.ID }).where({ ID: employee.ID });

        return `Employee ${employee.firstName} ${employee.lastName} assigned to Manager ${manager.firstName} ${manager.lastName}`;
    });

this.on('assignProjectToEmployee', async (req) => {
    const { employeeID, projectID } = req.data;
    
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) return 'Admin authentication failed';

    const employee = await SELECT.one.from(Employees).where({ employeeID });
    if (!employee) {
        return req.error(404, 'Employee not found');
    }

    const project = await SELECT.one.from(Projects).where({ projectID });
    if (!project) {
        return req.error(404, 'Project not found');
    }

    const existingAssignment = await SELECT.one
        .from('my.timesheet.ProjectAssignments')
        .where({ employee_ID: employee.ID, project_ID: project.ID, isActive: true });

    if (existingAssignment) {
        return req.error(400, `Employee is already assigned to project ${project.projectName}`);
    }


    const assignmentCount = await SELECT.from('my.timesheet.ProjectAssignments');
    await INSERT.into('my.timesheet.ProjectAssignments').entries({
        employee_ID: employee.ID,
        project_ID: project.ID,
        assignedBy_ID: admin.ID,
        assignedDate: new Date().toISOString(),
        isActive: true
    });

    console.log(` Created ProjectAssignment for ${employee.employeeID} → ${project.projectID}`);


    const timesheetsForProject = await SELECT.from(Timesheets)
        .where({ employee_ID: employee.ID, project_ID: project.ID });

    if (timesheetsForProject.length === 0) {
        const now = new Date();
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - now.getDay() + 1);
        currentWeekStart.setHours(0, 0, 0, 0);
        
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
        
        const weekStartStr = currentWeekStart.toISOString().split('T')[0];
        const weekEndStr = currentWeekEnd.toISOString().split('T')[0];
        
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i);
            weekDates.push(date.toISOString().split('T')[0]);
        }
        
        const employeeTimesheets = await SELECT.from(Timesheets)
            .where({ employee_ID: employee.ID });
        const timesheetID = `TS${String(employeeTimesheets.length + 1).padStart(4, '0')}`;
        
        await INSERT.into(Timesheets).entries({
            timesheetID: timesheetID,
            employee_ID: employee.ID,
            project_ID: project.ID,
            weekStartDate: weekStartStr,
            weekEndDate: weekEndStr,
            task: 'Developing',
            taskDetails: `Assigned to ${project.projectName}`,
            status: 'Draft',
            isBillable: project.isBillable,
            totalWeekHours: 0,
            
            mondayDate: weekDates[0],
            mondayDay: dayNames[0],
            mondayHours: 0,
            mondayTaskDetails: '',
            
            tuesdayDate: weekDates[1],
            tuesdayDay: dayNames[1],
            tuesdayHours: 0,
            tuesdayTaskDetails: '',
            
            wednesdayDate: weekDates[2],
            wednesdayDay: dayNames[2],
            wednesdayHours: 0,
            wednesdayTaskDetails: '',
            
            thursdayDate: weekDates[3],
            thursdayDay: dayNames[3],
            thursdayHours: 0,
            thursdayTaskDetails: '',
            
            fridayDate: weekDates[4],
            fridayDay: dayNames[4],
            fridayHours: 0,
            fridayTaskDetails: '',
            
            saturdayDate: weekDates[5],
            saturdayDay: dayNames[5],
            saturdayHours: 0,
            saturdayTaskDetails: '',
            
            sundayDate: weekDates[6],
            sundayDay: dayNames[6],
            sundayHours: 0,
            sundayTaskDetails: ''
        });
        
        console.log(`Created placeholder timesheet ${timesheetID}`);
    }

    const notificationCount = await SELECT.from(Notifications);

await INSERT.into(Notifications).entries({
    notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
    recipient_ID: employee.ID,
    message: `Admin has assigned you to project "${project.projectName}" (${project.projectID}). Please review your project assignments and start logging your timesheet entries.`,
    notificationType: 'Project Assignment',
    isRead: false,
    relatedEntity: 'Project',
    relatedEntityID: project.ID
});

if (employee.managerID_ID) {
    await INSERT.into(Notifications).entries({
        notificationID: `NOT${String(notificationCount.length + 2).padStart(4, '0')}`,
        recipient_ID: employee.managerID_ID,
        message: `Your team member ${employee.firstName} ${employee.lastName} (${employee.employeeID}) has been assigned to project "${project.projectName}" (${project.projectID}) by Admin. Please monitor their progress.`,
        notificationType: 'Team Project Assignment',
        isRead: false,
        relatedEntity: 'Project',
        relatedEntityID: project.ID
    });
}

console.log('Enhanced notifications created for project assignment');

    return `Project ${project.projectName} assigned to ${employee.firstName} ${employee.lastName} successfully`;
});

    this.on('deactivateEmployee', async (req) => {
        const { employeeID } = req.data;


        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const employee = await SELECT.one.from(Employees).where({ employeeID });
        if (!employee) {
            return req.error(404, 'Employee not found');
        }

        if (!employee.isActive) {
            return req.error(400, 'Employee is already inactive');
        }

        await UPDATE(Employees).set({ isActive: false }).where({ ID: employee.ID });

        return `Employee ${employee.firstName} ${employee.lastName} deactivated successfully`;
    });


    this.on('deactivateManager', async (req) => {
        const { employeeID } = req.data;

        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const employee = await SELECT.one.from(Employees).where({ employeeID });
        if (!employee) {
            return req.error(404, 'Employee not found');
        }

        if (!employee.isActive) {
            return req.error(400, 'Employee is already inactive');
        }

        const activeEmployees = await SELECT.from(Employees)
            .where({ managerID_ID: employee.ID, isActive: true });

        if (activeEmployees.length > 0) {
            return req.error(400, `Cannot deactivate manager with ${activeEmployees.length} active employees. Please reassign them first.`);
        }

        const activeProjects = await SELECT.from(Projects)
            .where({ projectOwner_ID: employee.ID, status: 'Active' });

        if (activeProjects.length > 0) {
            return req.error(400, `Cannot deactivate manager with ${activeProjects.length} active projects. Please reassign them first.`);
        }

        await UPDATE(Employees).set({ isActive: false }).where({ ID: employee.ID });

        return `Manager ${employee.firstName} ${employee.lastName} deactivated successfully`;
    });


    this.on('updateEmployeeDetails', async (req) => {
        const { employeeID, firstName, lastName, email } = req.data;


        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const employee = await SELECT.one.from(Employees).where({ employeeID });
        if (!employee) {
            return req.error(404, 'Employee not found');
        }

        if (email !== employee.email) {
            const existingEmail = await SELECT.one.from(Employees)
                .where({ email, ID: { '!=': employee.ID } });
            if (existingEmail) {
                return req.error(400, 'Email already exists');
            }
        }

        await UPDATE(Employees)
            .set({ firstName, lastName, email })
            .where({ ID: employee.ID });

        return `Employee ${firstName} ${lastName} updated successfully`;
    });


    this.on('updateRoleDetails', async (req) => {
        const { roleID, roleName, description } = req.data;


        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const role = await SELECT.one.from(UserRoles).where({ roleID });
        if (!role) {
            return req.error(404, 'Role not found');
        }

        await UPDATE(UserRoles)
            .set({ roleName, description })
            .where({ ID: role.ID });

        return `Role ${roleName} updated successfully`;
    });


    this.before('DELETE', 'Employees', async (req) => {

        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return req.reject(403, 'Admin access required');

        const employeeID = req.data.ID;
       
        const timesheets = await SELECT.from(Timesheets).where({ employee_ID: employeeID });
        if (timesheets.length > 0) {
            return req.error(400, 'Cannot delete employee with existing timesheets. Consider deactivating instead.');
        }
    });


    this.before('CREATE', 'UserRoles', async (req) => {
        if (!req.data.roleID) {
            const count = await SELECT.from(UserRoles);
            req.data.roleID = `ROLE${String(count.length + 1).padStart(3, '0')}`;
        }
    });

    this.before('CREATE', 'Activities', async (req) => {
        if (!req.data.activityID) {
            const count = await SELECT.from(Activities);
            req.data.activityID = `ACT${String(count.length + 1).padStart(4, '0')}`;
        }
    });

    this.before('CREATE', 'NonProjectTypes', async (req) => {
        if (!req.data.nonProjectTypeID) {
            const count = await SELECT.from(NonProjectTypes);
            req.data.nonProjectTypeID = `NPT${String(count.length + 1).padStart(3, '0')}`;
        }
    });


this.before('CREATE', 'LeaveTypes', async (req) => {
    if (!req.data.leaveTypeID) {
        const count = await SELECT.from('my.timesheet.LeaveTypes');
        req.data.leaveTypeID = `LT${String(count.length + 1).padStart(3, '0')}`;
        console.log(' Generated leaveTypeID:', req.data.leaveTypeID);
    }
});


this.before('CREATE', 'EmployeeLeaveBalance', async (req) => {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) return req.reject(403, 'Admin access required');

    if (!req.data.year) {
        req.data.year = new Date().getFullYear();
    }

    if (req.data.totalLeaves === undefined) {
        req.data.totalLeaves = 10;
    }
    if (req.data.usedLeaves === undefined) {
        req.data.usedLeaves = 0;
    }
    if (req.data.remainingLeaves === undefined) {
        req.data.remainingLeaves = req.data.totalLeaves;
    }

    console.log('Employee Leave Balance validated');
});


this.before('UPDATE', 'EmployeeLeaveBalance', async (req) => {
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) return req.reject(403, 'Admin access required');


    if (req.data.usedLeaves !== undefined || req.data.totalLeaves !== undefined) {
        const balanceID = req.data.ID;
        const currentBalance = await SELECT.one
            .from('my.timesheet.EmployeeLeaveBalance')
            .where({ ID: balanceID });

        if (currentBalance) {
            const totalLeaves = req.data.totalLeaves !== undefined 
                ? req.data.totalLeaves 
                : currentBalance.totalLeaves;
            
            const usedLeaves = req.data.usedLeaves !== undefined 
                ? req.data.usedLeaves 
                : currentBalance.usedLeaves;

            req.data.remainingLeaves = totalLeaves - usedLeaves;

            console.log('Recalculated remaining leaves:', req.data.remainingLeaves);
        }
    }
});

    this.before('CREATE', 'Projects', async (req) => {
        if (!req.data.projectID) {
            const count = await SELECT.from(Projects);
            req.data.projectID = `PRJ${String(count.length + 1).padStart(4, '0')}`;
        }
    });

    this.on("approveTimesheet", async (req) => {
        const { timesheetID } = req.data;
        if (!timesheetID) return req.reject(400, "Missing timesheetID");

        const timesheet = await SELECT.one.from(Timesheets).where({ timesheetID });
        if (!timesheet) return req.reject(404, `Timesheet ${timesheetID} not found`);

        await UPDATE(Timesheets)
            .set({
                status: "Approved",
                approvalDate: new Date().toISOString(),
                approvedBy_ID: req.user.id || "admin",
            })
            .where({ timesheetID });

        return `Timesheet ${timesheetID} approved successfully`;
    });

    this.on("rejectTimesheet", async (req) => {
        const { timesheetID, reason } = req.data;
        if (!timesheetID) return req.reject(400, "Missing timesheetID");

        const timesheet = await SELECT.one.from(Timesheets).where({ timesheetID });
        if (!timesheet) return req.reject(404, `Timesheet ${timesheetID} not found`);

        await UPDATE(Timesheets)
            .set({
                status: "Rejected",
                taskDetails: `${timesheet.taskDetails || ''}\nRejection Reason: ${reason || 'No reason provided'}`,
                approvalDate: new Date().toISOString(),
                approvedBy_ID: req.user.id || "admin",
            })
            .where({ timesheetID });

        return `🚫 Timesheet ${timesheetID} rejected. Reason: ${reason || "No reason provided"}`;
    });
   

this.on('READ', 'AvailableManagers', async (req) => {
    console.log('AvailableManagers READ - Start with enhancements');
    
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) return [];

    const managers = await SELECT.from('my.timesheet.Employees')
        .where({ isActive: true });

    const enrichedManagers = [];

    for (const emp of managers) {

        if (emp.userRole_ID) {
            const role = await SELECT.one.from('my.timesheet.UserRoles')
                .where({ ID: emp.userRole_ID });
            
            if (role && role.roleName === 'Manager') {

                const teamMembers = await SELECT.from('my.timesheet.Employees')
                    .where({ managerID_ID: emp.ID, isActive: true });
                
                const teamSize = teamMembers.length;

                const managerProjects = await SELECT.from('my.timesheet.Projects')
                    .where({ projectOwner_ID: emp.ID });
                
                const totalProjects = managerProjects.length;

                
                enrichedManagers.push({
                    ...emp,
                    roleName: role.roleName,
                    teamSize: teamSize,
                    totalProjects: totalProjects
                });
            }
        }
    }

    console.log('AvailableManagers enriched:', enrichedManagers.length, 'managers');
    return enrichedManagers;
});

this.on('READ', 'OverallProgressSummary', async (req) => {
    console.log('OverallProgressSummary READ - Start');
    
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) return [];

    const projects = await SELECT.from('my.timesheet.Projects');

    const summaryData = [];

    for (const project of projects) {

        const startDate = new Date(project.startDate);
        const endDate = new Date(project.endDate);
        const durationMs = endDate - startDate;
        const duration = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const remainingMs = endDate - today;
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

        let status = 'On Track';
        if (remainingDays < 0) {
            status = 'Delayed';
        } else if (project.status === 'Completed') {
            status = 'Completed';
        } else if (project.status === 'On Hold') {
            status = 'On Hold';
        }

        const projectTimesheets = await SELECT.from('my.timesheet.Timesheets')
            .where({ project_ID: project.ID });
        
        let bookedHours = 0;
        for (const ts of projectTimesheets) {
            bookedHours += parseFloat(ts.totalWeekHours || 0);
        }
        const allocatedHours = project.allocatedHours || 0;
        const remainingHours = allocatedHours - bookedHours;
        const utilization = allocatedHours > 0 
            ? parseFloat(((bookedHours / allocatedHours) * 100).toFixed(2))
            : 0;

        summaryData.push({
            ID: project.ID,
            projectID: project.projectID,
            projectName: project.projectName,
            startDate: project.startDate,
            endDate: project.endDate,
            duration: duration,
            remainingDays: remainingDays,
            status: status,
            allocatedHours: allocatedHours,
            bookedHours: parseFloat(bookedHours.toFixed(2)),
            remainingHours: parseFloat(remainingHours.toFixed(2)),
            utilization: utilization
        });
    }

    console.log('OverallProgressSummary generated for', summaryData.length, 'projects');
    return summaryData;
});

this.on('READ', 'Notifications', async (req) => {
    console.log('📧 Admin Notifications READ - Enhanced');
    
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) return [];


    const notifications = await SELECT.from('my.timesheet.Notifications')
        .orderBy('createdAt desc');


    for (const notif of notifications) {
        if (notif.recipient_ID) {
            const recipient = await SELECT.one.from('my.timesheet.Employees')
                .columns('firstName', 'lastName', 'employeeID')
                .where({ ID: notif.recipient_ID });
            
            if (recipient) {
                notif.recipientName = `${recipient.firstName} ${recipient.lastName}`;
                notif.recipientEmpID = recipient.employeeID;
            }
        }


        if (notif.relatedEntity === 'Timesheet' && notif.relatedEntityID) {
            const timesheet = await SELECT.one.from('my.timesheet.Timesheets')
                .columns('timesheetID', 'weekStartDate', 'weekEndDate', 'status')
                .where({ ID: notif.relatedEntityID });
            
            if (timesheet) {
                notif.relatedDetails = `Timesheet ${timesheet.timesheetID} (Week: ${timesheet.weekStartDate} to ${timesheet.weekEndDate}) - Status: ${timesheet.status}`;
            }
        } else if (notif.relatedEntity === 'Project' && notif.relatedEntityID) {
            const project = await SELECT.one.from('my.timesheet.Projects')
                .columns('projectID', 'projectName')
                .where({ ID: notif.relatedEntityID });
            
            if (project) {
                notif.relatedDetails = `Project: ${project.projectName} (${project.projectID})`;
            }
        } else if (notif.relatedEntity === 'Employee' && notif.relatedEntityID) {
            const employee = await SELECT.one.from('my.timesheet.Employees')
                .columns('employeeID', 'firstName', 'lastName')
                .where({ ID: notif.relatedEntityID });
            
            if (employee) {
                notif.relatedDetails = `Employee: ${employee.firstName} ${employee.lastName} (${employee.employeeID})`;
            }
        }
    }

    console.log('Admin Notifications enriched:', notifications.length);
    return notifications;
});

const createNotification = async (recipientID, message, type, entityType, entityID) => {
    const notificationCount = await SELECT.from('my.timesheet.Notifications');
    
    await INSERT.into('my.timesheet.Notifications').entries({
        notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
        recipient_ID: recipientID,
        message: message,
        notificationType: type,
        isRead: false,
        relatedEntity: entityType,
        relatedEntityID: entityID
    });
    
    console.log(`Notification created: ${type} for recipient ${recipientID}`);
};


this.on('READ', 'LeaveSummary', async (req) => {
    console.log('📊 LeaveSummary READ - Start');
    
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) return [];

    const currentYear = new Date().getFullYear();

    const employees = await SELECT.from('my.timesheet.Employees')
        .where({ isActive: true });
         
    const summaryData = [];

    const leaveTypes = await SELECT.from('my.timesheet.LeaveTypes')
        .where({ isActive: true });

    for (const employee of employees) {
        let userRoleID = null;
        let userRoleName = 'No Role';
        let roleDescription = 'No role assigned';
        
        if (employee.userRole_ID) {
            const role = await SELECT.one
                .from('my.timesheet.UserRoles')
                .where({ ID: employee.userRole_ID });
            
            if (role) {
                userRoleID = role.roleID;
                userRoleName = role.roleName;
                roleDescription = role.description || '';
            }
        }

        for (const leaveType of leaveTypes) {
            let balance = await SELECT.one
                .from('my.timesheet.EmployeeLeaveBalance')
                .where({ 
                    employee_ID: employee.ID, 
                    leaveType_ID: leaveType.ID,
                    year: currentYear 
                });

            if (!balance) {
                await INSERT.into('my.timesheet.EmployeeLeaveBalance').entries({
                    employee_ID: employee.ID,
                    leaveType_ID: leaveType.ID,
                    year: currentYear,
                    totalLeaves: 10,
                    usedLeaves: 0,
                    remainingLeaves: 10
                });

                balance = await SELECT.one
                    .from('my.timesheet.EmployeeLeaveBalance')
                    .where({ 
                        employee_ID: employee.ID, 
                        leaveType_ID: leaveType.ID,
                        year: currentYear 
                    });

                console.log(`✅ Created leave balance for ${employee.employeeID} - ${leaveType.typeName}`);
            }

            summaryData.push({
                ID: balance.ID,
                employeeID: employee.ID,
                empID: employee.employeeID,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                employeeEmail: employee.email,
                leaveTypeID: leaveType.leaveTypeID,
                leaveTypeName: leaveType.typeName, 
                defaultHours: leaveType.defaultHours,
                year: currentYear,
                userRoleID: userRoleID,
                userRoleName: userRoleName,
                roleDescription: roleDescription,
                totalLeaves: balance.totalLeaves || 10,
                usedLeaves: balance.usedLeaves || 0,
                remainingLeaves: balance.remainingLeaves || 10,
                createdAt: balance.createdAt,
                modifiedAt: balance.modifiedAt
            });
        }
    }

    console.log('📊 LeaveSummary generated for', summaryData.length, 'records');
    return summaryData;
});

    this.on('deleteEmployeeTimesheets', async (req) => {
        const { employeeID } = req.data;
        
        console.log('deleteEmployeeTimesheets called for:', employeeID);
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        if (!employeeID) {
            return req.error(400, 'Employee ID is required');
        }

        const employee = await SELECT.one.from(Employees).where({ employeeID });
        if (!employee) {
            return req.error(404, `Employee with ID ${employeeID} not found`);
        }

        try {

            const timesheets = await SELECT.from(Timesheets).where({ employee_ID: employee.ID });
            const count = timesheets.length;
            await DELETE.from(Timesheets).where({ employee_ID: employee.ID });
            

            await DELETE.from(Notifications).where({ 
                relatedEntity: 'Timesheet',
                recipient_ID: employee.ID 
            });
            
            console.log(`Deleted ${count} timesheets for employee ${employeeID}`);
            return `Successfully deleted ${count} timesheet(s) for ${employee.firstName} ${employee.lastName}`;
        } catch (error) {
            console.error('Error deleting timesheets:', error);
            return req.error(500, 'Failed to delete timesheets: ' + error.message);
        }
    });

    this.on('deleteEmployeeTimesheetsByStatus', async (req) => {
        const { employeeID, status } = req.data;
        
        console.log('🗑️ deleteEmployeeTimesheetsByStatus called:', { employeeID, status });
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        if (!employeeID || !status) {
            return req.error(400, 'Employee ID and status are required');
        }

        const employee = await SELECT.one.from(Employees).where({ employeeID });
        if (!employee) {
            return req.error(404, 'Employee not found');
        }

        try {
            const timesheets = await SELECT.from(Timesheets)
                .where({ employee_ID: employee.ID, status: status });
            const count = timesheets.length;
            
            await DELETE.from(Timesheets)
                .where({ employee_ID: employee.ID, status: status });
            
            console.log(`Deleted ${count} ${status} timesheets`);
            return `Successfully deleted ${count} ${status} timesheet(s) for ${employee.firstName} ${employee.lastName}`;
        } catch (error) {
            console.error('Error:', error);
            return req.error(500, 'Failed to delete timesheets: ' + error.message);
        }
    });

    this.on('deleteTimesheet', async (req) => {
        const { timesheetID } = req.data;
        
        console.log('🗑️ deleteTimesheet called for:', timesheetID);
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        if (!timesheetID) {
            return req.error(400, 'Timesheet ID is required');
        }

        const timesheet = await SELECT.one.from(Timesheets).where({ timesheetID });
        if (!timesheet) {
            return req.error(404, `Timesheet ${timesheetID} not found`);
        }

        try {
            await DELETE.from(Timesheets).where({ ID: timesheet.ID });
            
            console.log(`Deleted timesheet ${timesheetID}`);
            return `Timesheet ${timesheetID} deleted successfully`;
        } catch (error) {
            console.error('Error:', error);
            return req.error(500, 'Failed to delete timesheet: ' + error.message);
        }
    });

    this.on('deleteTimesheetsByWeek', async (req) => {
        const { employeeID, weekStartDate } = req.data;
        
        console.log('🗑️ deleteTimesheetsByWeek called:', { employeeID, weekStartDate });
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        if (!employeeID || !weekStartDate) {
            return req.error(400, 'Employee ID and week start date are required');
        }

        const employee = await SELECT.one.from(Employees).where({ employeeID });
        if (!employee) {
            return req.error(404, 'Employee not found');
        }

        try {
            const timesheets = await SELECT.from(Timesheets)
                .where({ employee_ID: employee.ID, weekStartDate: weekStartDate });
            const count = timesheets.length;
            
            await DELETE.from(Timesheets)
                .where({ employee_ID: employee.ID, weekStartDate: weekStartDate });
            
            console.log(`Deleted ${count} timesheets for week ${weekStartDate}`);
            return `Successfully deleted ${count} timesheet(s) for week starting ${weekStartDate}`;
        } catch (error) {
            console.error('Error:', error);
            return req.error(500, 'Failed to delete timesheets: ' + error.message);
        }
    });


    this.on('deleteAllTimesheets', async (req) => {
        console.log('🗑️ deleteAllTimesheets called - DELETING ALL TIMESHEETS!');
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        try {
  
            const timesheets = await SELECT.from(Timesheets);
            const count = timesheets.length;
            

            await DELETE.from(Timesheets);
            
            await DELETE.from(Notifications).where({ relatedEntity: 'Timesheet' });
            
            console.log(`Deleted all ${count} timesheets`);
            return `Successfully deleted all ${count} timesheet records from the system`;
        } catch (error) {
            console.error(' Error deleting all timesheets:', error);
            return req.error(500, 'Failed to delete timesheets: ' + error.message);
        }
    });

    this.on('deleteEmployee', async (req) => {
        const { employeeID } = req.data;
        
        console.log('deleteEmployee called for:', employeeID);
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        if (!employeeID) {
            return req.error(400, 'Employee ID is required');
        }

        const employee = await SELECT.one.from(Employees).where({ employeeID });
        if (!employee) {
            return req.error(404, `Employee with ID ${employeeID} not found`);
        }

        try {

            const timesheets = await SELECT.from(Timesheets).where({ employee_ID: employee.ID });
            if (timesheets.length > 0) {
                return req.error(400, `Cannot delete employee with ${timesheets.length} existing timesheet(s). Please delete timesheets first or use deactivate instead.`);
            }

            const managedEmployees = await SELECT.from(Employees)
                .where({ managerID_ID: employee.ID, isActive: true });
            if (managedEmployees.length > 0) {
                return req.error(400, `Cannot delete employee who is managing ${managedEmployees.length} active employee(s). Please reassign them first.`);
            }

            const ownedProjects = await SELECT.from(Projects)
                .where({ projectOwner_ID: employee.ID });
            if (ownedProjects.length > 0) {
                return req.error(400, `Cannot delete employee who owns ${ownedProjects.length} project(s). Please reassign project ownership first.`);
            }

            await DELETE.from('my.timesheet.ProjectAssignments')
                .where({ employee_ID: employee.ID });

            await DELETE.from(Notifications)
                .where({ recipient_ID: employee.ID });

            await DELETE.from(Employees).where({ ID: employee.ID });
            
            console.log(`Employee ${employeeID} deleted successfully`);
            return `Employee ${employee.firstName} ${employee.lastName} (${employeeID}) has been permanently deleted from the system`;
        } catch (error) {
            console.error('Error deleting employee:', error);
            return req.error(500, 'Failed to delete employee: ' + error.message);
        }
    });

    this.on('changeEmployeeRole', async (req) => {
        const { employeeID, newRoleID } = req.data;
        
        console.log('🔄 changeEmployeeRole called:', { employeeID, newRoleID });
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        if (!employeeID || !newRoleID) {
            return req.error(400, 'Employee ID and new role ID are required');
        }

        const employee = await SELECT.one.from(Employees).where({ employeeID });
        if (!employee) {
            return req.error(404, 'Employee not found');
        }

        const newRole = await SELECT.one.from(UserRoles).where({ ID: newRoleID });
        if (!newRole) {
            return req.error(404, 'New role not found');
        }

        const currentRole = employee.userRole_ID ? 
            await SELECT.one.from(UserRoles).where({ ID: employee.userRole_ID }) : null;
        
        const currentRoleName = currentRole ? currentRole.roleName : 'None';

        try {
            if (currentRoleName === 'Manager' && newRole.roleName !== 'Manager') {
                const managedEmployees = await SELECT.from(Employees)
                    .where({ managerID_ID: employee.ID, isActive: true });
                
                if (managedEmployees.length > 0) {
                    return req.error(400, 
                        `Cannot change role from Manager to ${newRole.roleName}. ` +
                        `This employee is currently managing ${managedEmployees.length} active employee(s). ` +
                        `Please reassign these employees to another manager first.`
                    );
                }
                const ownedProjects = await SELECT.from(Projects)
                    .where({ projectOwner_ID: employee.ID, status: 'Active' });
                
                if (ownedProjects.length > 0) {
                    return req.error(400, 
                        `Cannot change role from Manager to ${newRole.roleName}. ` +
                        `This employee owns ${ownedProjects.length} active project(s). ` +
                        `Please reassign project ownership first.`
                    );
                }
            }


            if (newRole.roleName === 'Employee' && 
                (currentRoleName === 'Manager' || currentRoleName === 'Admin')) {
                

                if (!employee.managerID_ID) {
                    return req.error(400, 
                        `Cannot change role to Employee without a manager assigned. ` +
                        `Please assign a manager to this employee first using assignEmployeeToManager action.`
                    );
                }
            }

            await UPDATE(Employees)
                .set({ userRole_ID: newRoleID })
                .where({ ID: employee.ID });

            const notificationCount = await SELECT.from(Notifications);
            await INSERT.into(Notifications).entries({
                notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
                recipient_ID: employee.ID,
                message: `Your role has been changed from ${currentRoleName} to ${newRole.roleName} by Admin`,
                notificationType: 'Role Change',
                isRead: false,
                relatedEntity: 'Employee',
                relatedEntityID: employee.ID
            });

            console.log(`Role changed: ${employeeID} from ${currentRoleName} to ${newRole.roleName}`);
            return `Successfully changed role for ${employee.firstName} ${employee.lastName} from ${currentRoleName} to ${newRole.roleName}`;
        } catch (error) {
            console.error('Error changing employee role:', error);
            return req.error(500, 'Failed to change employee role: ' + error.message);
        }
    });


this.on('READ', 'Documents', async (req) => {
    console.log('Documents READ (Admin)');

    try {
        const documents = await SELECT.from('my.timesheet.Documents');

        for (const doc of documents) {
            if (doc.uploadedBy_ID) {
                const uploader = await SELECT.one
                    .from('my.timesheet.Employees')
                    .columns('firstName', 'lastName')
                    .where({ ID: doc.uploadedBy_ID });
                
                if (uploader) {
                    doc.uploadedByName = `${uploader.firstName} ${uploader.lastName}`;
                }
            }
            
            delete doc.content;
        }

        return documents;

    } catch (error) {
        console.error('Error reading documents:', error);
        return [];
    }
});

this.on('uploadDocument', async (req) => {
    console.log('Upload Document (Admin)');
    const { 
        documentName, 
        documentType, 
        description, 
        fileName, 
        mimeType, 
        content, 
        category, 
        version, 
        accessLevel 
    } = req.data;

    if (!documentName || !fileName || !mimeType || !content) {
        return req.error(400, 'Required fields: documentName, fileName, mimeType, content');
    }

    try {
        const existingDocs = await SELECT.from('my.timesheet.Documents');
        const documentID = `DOC${String(existingDocs.length + 1).padStart(4, '0')}`;

        let fileSize = 0;
        if (typeof content === 'string') {
            fileSize = Math.ceil((content.length * 3) / 4);
        } else if (Buffer.isBuffer(content)) {
            fileSize = content.length;
        }

        await INSERT.into('my.timesheet.Documents').entries({
            documentID: documentID,
            documentName: documentName,
            documentType: documentType || 'General',
            description: description || '',
            fileName: fileName,
            mimeType: mimeType,
            fileSize: fileSize,
            content: content,
            category: category || 'Manual',
            version: version || '1.0',
            isActive: true,
            accessLevel: accessLevel || 'All'
        });

        console.log('Document uploaded:', documentID);
        return `Document uploaded successfully with ID: ${documentID}`;

    } catch (error) {
        console.error('Error uploading document:', error);
        return req.error(500, 'Failed to upload document');
    }
});

this.on('deleteDocument', async (req) => {
    const { documentID } = req.data;

    if (!documentID) {
        return req.error(400, 'Document ID is required');
    }

    try {
        await UPDATE('my.timesheet.Documents')
            .set({ isActive: false })
            .where({ documentID: documentID });

        return `Document ${documentID} deleted successfully`;

    } catch (error) {
        console.error('Error deleting document:', error);
        return req.error(500, 'Failed to delete document');
    }
});
});