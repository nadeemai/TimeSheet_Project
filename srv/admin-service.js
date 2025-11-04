const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
    const { Employees, UserRoles, Activities, NonProjectTypes, Projects, Timesheets, Notifications } = this.entities;

    //  Helper to get and validate admin
    const getAuthenticatedAdmin = async (req) => {
        const userId = req.user.id;
        
        if (!userId) {
            req.error(401, 'User not authenticated');
            return null;
        }

        const admin = await SELECT.one.from(Employees)
            .where({ ID: userId, isActive: true });

        if (!admin) {
            req.error(404, 'Admin profile not found or inactive. Please contact administrator.');
            return null;
        }

        // Verify user has admin role
        if (admin.userRole_ID) {
            const role = await SELECT.one.from(UserRoles)
                .where({ ID: admin.userRole_ID });
            
            if (role && role.roleName !== 'Admin') {
                req.error(403, 'Access denied. Admin role required.');
                return null;
            }
        }

        return admin;
    };

    //  Validate admin access before sensitive operations
    this.before(['CREATE', 'UPDATE', 'DELETE'], ['Employees', 'UserRoles', 'Activities', 'NonProjectTypes'], async (req) => {
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) {
            req.reject(403, 'Admin access required');
        }
    });

    // Validate admin access for read operations on sensitive entities
    this.before('READ', ['Employees', 'Timesheets', 'Notifications'], async (req) => {
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) {
            req.reject(403, 'Admin access required');
        }
    });

    // Action: Create Employee
    this.on('createEmployee', async (req) => {
        const { employeeID, firstName, lastName, email, managerEmployeeID, roleID } = req.data;

        // Validate admin
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

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

    // Action: Assign Employee to Manager
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

        await UPDATE(Employees).set({ managerID_ID: manager.ID }).where({ ID: employee.ID });

        return `Employee ${employee.firstName} ${employee.lastName} assigned to Manager ${manager.firstName} ${manager.lastName}`;
    });

    // ✅ CHANGE 1: Admin can assign projects to employees
    this.on('assignProjectToEmployee', async (req) => {
        const { employeeID, projectID } = req.data;
        
        const admin = await getAuthenticatedAdmin(req);
        if (!admin) return 'Admin authentication failed';

        // Verify employee exists
        const employee = await SELECT.one.from(Employees).where({ employeeID });
        if (!employee) {
            return req.error(404, 'Employee not found');
        }

        // Verify project exists
        const project = await SELECT.one.from(Projects).where({ projectID });
        if (!project) {
            return req.error(404, 'Project not found');
        }

        // Create notification for employee
        const notificationCount = await SELECT.from(Notifications);
        await INSERT.into(Notifications).entries({
            notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
            recipient_ID: employee.ID,
            message: `Admin assigned you to project: ${project.projectName}`,
            notificationType: 'Project Assignment',
            isRead: false,
            relatedEntity: 'Project',
            relatedEntityID: project.ID
        });

        // Also notify manager if exists
        if (employee.managerID_ID) {
            await INSERT.into(Notifications).entries({
                notificationID: `NOT${String(notificationCount.length + 2).padStart(4, '0')}`,
                recipient_ID: employee.managerID_ID,
                message: `${employee.firstName} ${employee.lastName} has been assigned to project: ${project.projectName}`,
                notificationType: 'Project Assignment',
                isRead: false,
                relatedEntity: 'Project',
                relatedEntityID: project.ID
            });
        }

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

    // Auto-generate IDs if not provided
    this.before('CREATE', 'Employees', async (req) => {
        if (!req.data.employeeID) {
            const count = await SELECT.from(Employees);
            req.data.employeeID = `EMP${String(count.length + 1).padStart(4, '0')}`;
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
    /**
   * 🟩 Approve Timesheet Handler
   */
  this.on("approveTimesheet", async (req) => {
    const { timesheetID } = req.data;
    if (!timesheetID) return req.reject(400, "❌ Missing timesheetID");

    // Check if timesheet exists
    const timesheet = await SELECT.one.from(Timesheets).where({ timesheetID });
    if (!timesheet) return req.reject(404, `❌ Timesheet ${timesheetID} not found`);

    // Update status to Approved
    await UPDATE(Timesheets)
      .set({
        status: "Approved",
        approvalDate: new Date().toISOString(),
        approvedBy_ID: req.user.id || "admin",
      })
      .where({ timesheetID });

    return `✅ Timesheet ${timesheetID} approved successfully by ${req.user.id || "admin"}`;
  });

  /**
   * 🟥 Reject Timesheet Handler
   */
  this.on("rejectTimesheet", async (req) => {
    const { timesheetID, reason } = req.data;
    if (!timesheetID) return req.reject(400, "❌ Missing timesheetID");

    // Check if timesheet exists
    const timesheet = await SELECT.one.from(Timesheets).where({ timesheetID });
    if (!timesheet) return req.reject(404, `❌ Timesheet ${timesheetID} not found`);

    // Update status to Rejected with reason
    await UPDATE(Timesheets)
      .set({
        status: "Rejected",
        comments: reason || "Rejected by Admin",
        approvalDate: new Date().toISOString(),
        approvedBy_ID: req.user.id || "admin",
      })
      .where({ timesheetID });

    return `🚫 Timesheet ${timesheetID} rejected. Reason: ${reason || "No reason provided"}`;
  });
});