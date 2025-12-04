const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
    const { Employees, UserRoles, Activities, NonProjectTypes, Projects, Timesheets, Notifications } = this.entities;

    //Helper to get and validate admin with better error handling
    const getAuthenticatedAdmin = async (req) => {
    const userId = req.user.id;
    
    console.log('🔍 Admin Auth - User ID from BTP:', userId);
    console.log('🔍 Admin Auth - User roles:', req.user.attr);
    
    if (!userId) {
        console.log('No user ID found');
        req.error(401, 'User not authenticated');
        return null;
    }

    // Check if user has Admin role in authentication system
    const hasAdminRole = req.user.is('Admin');
    console.log('🔍 Admin Auth - Has Admin role in BTP:', hasAdminRole);
    
    if (!hasAdminRole) {
        console.log('❌ User does not have Admin role in BTP');
        req.error(403, 'Admin role required. Please ensure you are logged in with Admin credentials.');
        return null;
    }

    // STRATEGY 1: Try to find by email directly
    let admin = await SELECT.one.from('my.timesheet.Employees')
        .where({ email: userId, isActive: true });

    // STRATEGY 2: If userId is not a full email, try appending domain
    if (!admin && !userId.includes('@')) {
        console.log('⚠️ User ID is not an email, trying with @sumodigitech.com domain...');
        const emailWithDomain = `${userId}@sumodigitech.com`;
        admin = await SELECT.one.from('my.timesheet.Employees')
            .where({ email: emailWithDomain, isActive: true });
    }

    // STRATEGY 3: Case-insensitive email search
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
        console.log('⚠️ Admin profile not found in database, but has Admin role in BTP');
        // Return a minimal admin object to allow operation
        return { 
            ID: userId, 
            isAdmin: true,
            employeeID: 'SYSTEM_ADMIN',
            email: userId
        };
    }

    // Verify user has admin role in database
    if (admin.userRole_ID) {
        const role = await SELECT.one.from('my.timesheet.UserRoles')
            .where({ ID: admin.userRole_ID });
            
        console.log('🔍 Admin Auth - Database role:', role?.roleName);
        
        if (role && role.roleName !== 'Admin') {
            console.log('❌ User role in database is not Admin');
            req.error(403, 'Access denied. Admin role required in database.');
            return null;
        }
    }

    console.log('Admin authenticated successfully:', admin.employeeID, 'Email:', admin.email);
    return admin;
};
    //Separate validation - more lenient for CREATE
    this.before('CREATE', 'Employees', async (req) => {
        console.log('🔍 Before CREATE Employee - Start validation');
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) {
            console.log('❌ Admin validation failed for CREATE');
            return req.reject(403, 'Admin access required');
        }
        
        console.log('Admin validation passed for CREATE');
        
        // Auto-generate employeeID if not provided
        if (!req.data.employeeID) {
            const count = await SELECT.from(Employees);
            req.data.employeeID = `EMP${String(count.length + 1).padStart(4, '0')}`;
            console.log('🔧 Generated employeeID:', req.data.employeeID);
        }
    });

    // Validate admin for UPDATE and DELETE on sensitive entities
    this.before(['UPDATE', 'DELETE'], ['Employees', 'UserRoles', 'Activities', 'NonProjectTypes'], async (req) => {
        console.log('🔍 Before UPDATE/DELETE - Start validation');
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) {
            console.log('Admin validation failed for UPDATE/DELETE');
            return req.reject(403, 'Admin access required');
        }
        
        console.log('Admin validation passed for UPDATE/DELETE');
    });

    // Action: Create Employee with manager assignment
    this.on('createEmployee', async (req) => {
        const { employeeID, firstName, lastName, email, managerEmployeeID, roleID } = req.data;

        console.log('🔍 createEmployee action called');
        
        // Validate admin
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) {
            console.log('createEmployee: Admin authentication failed');
            return 'Admin authentication failed';
        }

        console.log('createEmployee: Admin authenticated');

        const existing = await SELECT.one.from(Employees).where({ employeeID });
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
        if (managerEmployeeID) {
            manager = await SELECT.one.from(Employees).where({ employeeID: managerEmployeeID });
            if (!manager) {
                return req.error(404, 'Manager not found');
            }

            // Verify that the selected manager has Manager role
            if (manager.userRole_ID) {
                const managerRole = await SELECT.one.from(UserRoles)
                    .where({ ID: manager.userRole_ID });
                
                if (!managerRole || managerRole.roleName !== 'Manager') {
                    return req.error(400, 'Selected employee is not a Manager. Please select a valid Manager.');
                }
            }
        }

        await INSERT.into(Employees).entries({
            employeeID,
            firstName,
            lastName,
            email,
            isActive: true,
            userRole_ID: roleID,
            managerID_ID: manager ? manager.ID : null
        });

        console.log('Employee created successfully:', employeeID);
        return `Employee ${firstName} ${lastName} created successfully${manager ? ` and assigned to Manager ${manager.firstName} ${manager.lastName}` : ''}`;
    });

    // Action: Create Role
    this.on('createRole', async (req) => {
        const { roleID, roleName, description } = req.data;

        // Validate admin
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

    // Action: Create Activity
    this.on('createActivity', async (req) => {
        const { activityID, activity, activityType, projectID, isBillable, plannedHours, startDate, endDate } = req.data;

        //Validate admin
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const existing = await SELECT.one.from(Activities).where({ activityID });
        if (existing) {
            return req.error(400, 'Activity ID already exists');
        }

        // Validate activity type
        if (!['Project', 'NonProject', 'Mixed'].includes(activityType)) {
            return req.error(400, 'Activity type must be Project, NonProject, or Mixed');
        }

        // Verify project exists if provided
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

    // Action: Update Activity
    this.on('updateActivity', async (req) => {
        const { activityID, activity, activityType, projectID, isBillable, plannedHours, startDate, endDate, status } = req.data;

        // Validate admin
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const activityRecord = await SELECT.one.from(Activities).where({ activityID });
        if (!activityRecord) {
            return req.error(404, 'Activity not found');
        }

        // Validate activity type if provided
        if (activityType && !['Project', 'NonProject', 'Mixed'].includes(activityType)) {
            return req.error(400, 'Activity type must be Project, NonProject, or Mixed');
        }

        // Validate status if provided
        if (status && !['Active', 'Inactive', 'Completed'].includes(status)) {
            return req.error(400, 'Status must be Active, Inactive, or Completed');
        }

        // Verify project exists if provided
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

    // Action: Create Non-Project Type
    this.on('createNonProjectType', async (req) => {
        const { nonProjectTypeID, typeName, description, isBillable } = req.data;

        //Validate admin
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

    // Action: Update Non-Project Type
    this.on('updateNonProjectType', async (req) => {
        const { nonProjectTypeID, typeName, description, isBillable, isActive } = req.data;

        // Validate admin
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

    // Action: Create Project
    this.on('createProject', async (req) => {
        const { projectID, projectName, description, startDate, endDate, projectRole, budget, allocatedHours, projectOwnerID, isBillable } = req.data;

        //Validate admin
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const existing = await SELECT.one.from(Projects).where({ projectID });
        if (existing) {
            return req.error(400, 'Project ID already exists');
        }

        // Validate project role
        if (projectRole && !['Designing', 'Developing', 'Testing', 'Deployment'].includes(projectRole)) {
            return req.error(400, 'Project role must be Designing, Developing, Testing, or Deployment');
        }

        // Verify project owner exists
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

    // Action: Update Project
    this.on('updateProject', async (req) => {
        const { projectID, projectName, description, projectRole, budget, allocatedHours, status } = req.data;

        // Validate admin
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        const project = await SELECT.one.from(Projects).where({ projectID });
        if (!project) {
            return req.error(404, 'Project not found');
        }

        // Validate project role if provided
        if (projectRole && !['Designing', 'Developing', 'Testing', 'Deployment'].includes(projectRole)) {
            return req.error(400, 'Project role must be Designing, Developing, Testing, or Deployment');
        }

        // Validate status if provided
        if (status && !['Active', 'Completed', 'On Hold'].includes(status)) {
            return req.error(400, 'Status must be Active, Completed, or On Hold');
        }

        await UPDATE(Projects)
            .set({ projectName, description, projectRole, budget, allocatedHours, status })
            .where({ ID: project.ID });

        return `Project ${projectName} updated successfully`;
    });

    //  Action: Assign Employee to Manager (only Managers can be assigned)
    this.on('assignEmployeeToManager', async (req) => {
        const { employeeID, managerEmployeeID } = req.data;

        //Validate admin
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

        //Verify that the selected manager has Manager role
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

    // Create ProjectAssignment entry (this is the source of truth)
    const assignmentCount = await SELECT.from('my.timesheet.ProjectAssignments');
    await INSERT.into('my.timesheet.ProjectAssignments').entries({
        employee_ID: employee.ID,
        project_ID: project.ID,
        assignedBy_ID: admin.ID,
        assignedDate: new Date().toISOString(),
        isActive: true
    });

    console.log(` Created ProjectAssignment for ${employee.employeeID} → ${project.projectID}`);

    // Create placeholder timesheet for the current week
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
    // Action: Deactivate Employee
    this.on('deactivateEmployee', async (req) => {
        const { employeeID } = req.data;

        //Validate admin
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

    // Action: Deactivate Manager
    this.on('deactivateManager', async (req) => {
        const { employeeID } = req.data;

        // Validate admin
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

    // Action: Update Employee Details
    this.on('updateEmployeeDetails', async (req) => {
        const { employeeID, firstName, lastName, email } = req.data;

        // Validate admin
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

    // Action: Update Role Details
    this.on('updateRoleDetails', async (req) => {
        const { roleID, roleName, description } = req.data;

        //  Validate admin
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

    // Before DELETE - Cascade delete validation
    this.before('DELETE', 'Employees', async (req) => {
        //Validate admin
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

    this.before('CREATE', 'Projects', async (req) => {
        if (!req.data.projectID) {
            const count = await SELECT.from(Projects);
            req.data.projectID = `PRJ${String(count.length + 1).padStart(4, '0')}`;
        }
    });

    // Approve Timesheet Handler
    this.on("approveTimesheet", async (req) => {
        const { timesheetID } = req.data;
        if (!timesheetID) return req.reject(400, "❌ Missing timesheetID");

        const timesheet = await SELECT.one.from(Timesheets).where({ timesheetID });
        if (!timesheet) return req.reject(404, `❌ Timesheet ${timesheetID} not found`);

        await UPDATE(Timesheets)
            .set({
                status: "Approved",
                approvalDate: new Date().toISOString(),
                approvedBy_ID: req.user.id || "admin",
            })
            .where({ timesheetID });

        return `✅ Timesheet ${timesheetID} approved successfully`;
    });

    // Reject Timesheet Handler
    this.on("rejectTimesheet", async (req) => {
        const { timesheetID, reason } = req.data;
        if (!timesheetID) return req.reject(400, "❌ Missing timesheetID");

        const timesheet = await SELECT.one.from(Timesheets).where({ timesheetID });
        if (!timesheet) return req.reject(404, `❌ Timesheet ${timesheetID} not found`);

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
    console.log('📊 AvailableManagers READ - Start with enhancements');
    
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
    console.log('📊 OverallProgressSummary READ - Start');
    
    const admin = await getAuthenticatedAdmin(req);
    if (!admin) return [];

    // Get all projects
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
    
    console.log(`✅ Notification created: ${type} for recipient ${recipientID}`);
};

    // Action 1: Delete all timesheets for a specific employee
    this.on('deleteEmployeeTimesheets', async (req) => {
        const { employeeID } = req.data;
        
        console.log('🗑️ deleteEmployeeTimesheets called for:', employeeID);
        
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
            // Count timesheets before deletion
            const timesheets = await SELECT.from(Timesheets).where({ employee_ID: employee.ID });
            const count = timesheets.length;
            
            // Delete timesheets
            await DELETE.from(Timesheets).where({ employee_ID: employee.ID });
            
            // Delete related notifications
            await DELETE.from(Notifications).where({ 
                relatedEntity: 'Timesheet',
                recipient_ID: employee.ID 
            });
            
            console.log(`✅ Deleted ${count} timesheets for employee ${employeeID}`);
            return `Successfully deleted ${count} timesheet(s) for ${employee.firstName} ${employee.lastName}`;
        } catch (error) {
            console.error('❌ Error deleting timesheets:', error);
            return req.error(500, 'Failed to delete timesheets: ' + error.message);
        }
    });

    // Action 2: Delete timesheets by status for an employee
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
            
            console.log(`✅ Deleted ${count} ${status} timesheets`);
            return `Successfully deleted ${count} ${status} timesheet(s) for ${employee.firstName} ${employee.lastName}`;
        } catch (error) {
            console.error('❌ Error:', error);
            return req.error(500, 'Failed to delete timesheets: ' + error.message);
        }
    });

    // Action 3: Delete specific timesheet by ID
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
            
            console.log(`✅ Deleted timesheet ${timesheetID}`);
            return `Timesheet ${timesheetID} deleted successfully`;
        } catch (error) {
            console.error('❌ Error:', error);
            return req.error(500, 'Failed to delete timesheet: ' + error.message);
        }
    });

    // Action 4: Delete timesheets for a specific week
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
            
            console.log(`✅ Deleted ${count} timesheets for week ${weekStartDate}`);
            return `Successfully deleted ${count} timesheet(s) for week starting ${weekStartDate}`;
        } catch (error) {
            console.error('❌ Error:', error);
            return req.error(500, 'Failed to delete timesheets: ' + error.message);
        }
    });

    // Action 5: Delete ALL timesheets (all employees) - USE WITH CAUTION!
    this.on('deleteAllTimesheets', async (req) => {
        console.log('🗑️ deleteAllTimesheets called - DELETING ALL TIMESHEETS!');
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        try {
            // Count before deletion
            const timesheets = await SELECT.from(Timesheets);
            const count = timesheets.length;
            
            // Delete all timesheets
            await DELETE.from(Timesheets);
            
            // Delete all timesheet-related notifications
            await DELETE.from(Notifications).where({ relatedEntity: 'Timesheet' });
            
            console.log(`✅ Deleted all ${count} timesheets`);
            return `Successfully deleted all ${count} timesheet records from the system`;
        } catch (error) {
            console.error('❌ Error deleting all timesheets:', error);
            return req.error(500, 'Failed to delete timesheets: ' + error.message);
        }
    });
    // Action: Delete Employee (Permanent Deletion)
    this.on('deleteEmployee', async (req) => {
        const { employeeID } = req.data;
        
        console.log('🗑️ deleteEmployee called for:', employeeID);
        
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
            // Check if employee has any timesheets
            const timesheets = await SELECT.from(Timesheets).where({ employee_ID: employee.ID });
            if (timesheets.length > 0) {
                return req.error(400, `Cannot delete employee with ${timesheets.length} existing timesheet(s). Please delete timesheets first or use deactivate instead.`);
            }

            // Check if employee is a manager with active employees
            const managedEmployees = await SELECT.from(Employees)
                .where({ managerID_ID: employee.ID, isActive: true });
            if (managedEmployees.length > 0) {
                return req.error(400, `Cannot delete employee who is managing ${managedEmployees.length} active employee(s). Please reassign them first.`);
            }

            // Check if employee owns any projects
            const ownedProjects = await SELECT.from(Projects)
                .where({ projectOwner_ID: employee.ID });
            if (ownedProjects.length > 0) {
                return req.error(400, `Cannot delete employee who owns ${ownedProjects.length} project(s). Please reassign project ownership first.`);
            }

            // Delete project assignments
            await DELETE.from('my.timesheet.ProjectAssignments')
                .where({ employee_ID: employee.ID });

            // Delete notifications related to this employee
            await DELETE.from(Notifications)
                .where({ recipient_ID: employee.ID });

            // Delete the employee
            await DELETE.from(Employees).where({ ID: employee.ID });
            
            console.log(`✅ Employee ${employeeID} deleted successfully`);
            return `Employee ${employee.firstName} ${employee.lastName} (${employeeID}) has been permanently deleted from the system`;
        } catch (error) {
            console.error('❌ Error deleting employee:', error);
            return req.error(500, 'Failed to delete employee: ' + error.message);
        }
    });

    // Action: Change Employee Role
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

        // Get current role
        const currentRole = employee.userRole_ID ? 
            await SELECT.one.from(UserRoles).where({ ID: employee.userRole_ID }) : null;
        
        const currentRoleName = currentRole ? currentRole.roleName : 'None';

        try {
            // Special validation: If changing FROM Manager role
            if (currentRoleName === 'Manager' && newRole.roleName !== 'Manager') {
                // Check if manager has any employees assigned
                const managedEmployees = await SELECT.from(Employees)
                    .where({ managerID_ID: employee.ID, isActive: true });
                
                if (managedEmployees.length > 0) {
                    return req.error(400, 
                        `Cannot change role from Manager to ${newRole.roleName}. ` +
                        `This employee is currently managing ${managedEmployees.length} active employee(s). ` +
                        `Please reassign these employees to another manager first.`
                    );
                }

                // Check if manager owns any active projects
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

            // Special validation: If changing TO Employee role from Manager/Admin
            if (newRole.roleName === 'Employee' && 
                (currentRoleName === 'Manager' || currentRoleName === 'Admin')) {
                
                // Ensure they have a manager assigned
                if (!employee.managerID_ID) {
                    return req.error(400, 
                        `Cannot change role to Employee without a manager assigned. ` +
                        `Please assign a manager to this employee first using assignEmployeeToManager action.`
                    );
                }
            }

            // Update the role
            await UPDATE(Employees)
                .set({ userRole_ID: newRoleID })
                .where({ ID: employee.ID });

            // Create notification for the employee
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

            console.log(`✅ Role changed: ${employeeID} from ${currentRoleName} to ${newRole.roleName}`);
            return `Successfully changed role for ${employee.firstName} ${employee.lastName} from ${currentRoleName} to ${newRole.roleName}`;
        } catch (error) {
            console.error('❌ Error changing employee role:', error);
            return req.error(500, 'Failed to change employee role: ' + error.message);
        }
    });
});