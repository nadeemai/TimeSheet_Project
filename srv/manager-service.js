const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
    const { Employees, Projects, Timesheets, Notifications } = this.entities;

    //  Helper to get and validate manager
    const getAuthenticatedManager = async (req) => {
        const userId = req.user.id;
        
        if (!userId) {
            req.error(401, 'User not authenticated');
            return null;
        }

        const manager = await SELECT.one.from(Employees)
            .where({ ID: userId, isActive: true });

        if (!manager) {
            req.error(404, 'Manager profile not found or inactive. Please contact administrator.');
            return null;
        }

        // Verify user has manager role
        if (manager.userRole_ID) {
            const role = await SELECT.one.from('my.timesheet.UserRoles')
                .where({ ID: manager.userRole_ID });
            
            if (role && role.roleName !== 'Manager') {
                req.error(403, 'Access denied. Manager role required.');
                return null;
            }
        }

        return manager;
    };

    // Validate manager access before READ operations
    this.before('READ', ['MyManagerProfile', 'MyTeam', 'MyProjects', 'TeamTimesheets'], async (req) => {
        const manager = await getAuthenticatedManager(req);
        if (!manager) {
            req.reject(403, 'Manager not found or access denied');
        }
    });

    // Before CREATE Project - Automatically assign to manager and validate project role
    this.before('CREATE', 'MyProjects', async (req) => {
        const manager = await getAuthenticatedManager(req);
        if (!manager) return;
        
        const managerID = manager.ID;

        // Validate project role if provided
        if (req.data.projectRole) {
            if (!['Designing', 'Developing', 'Testing', 'Deployment'].includes(req.data.projectRole)) {
                return req.error(400, 'Project role must be Designing, Developing, Testing, or Deployment');
            }
        }

        req.data.projectOwner_ID = managerID;
       
        if (!req.data.status) {
            req.data.status = 'Active';
        }

        if (!req.data.projectID) {
            const count = await SELECT.from(Projects);
            req.data.projectID = `PRJ${String(count.length + 1).padStart(4, '0')}`;
        }

        // Set isBillable to true by default if not provided
        if (req.data.isBillable === undefined) {
            req.data.isBillable = true;
        }
    });

    // Before UPDATE Project - Verify ownership and validate project role
    this.before('UPDATE', 'MyProjects', async (req) => {
        const manager = await getAuthenticatedManager(req);
        if (!manager) return;
        
        const projectID = req.data.ID;
        const managerID = manager.ID;

        const project = await SELECT.one.from(Projects).where({ ID: projectID });
        if (!project) {
            return req.error(404, 'Project not found');
        }

        if (project.projectOwner_ID !== managerID) {
            return req.error(403, 'You can only update your own projects');
        }

        // Validate project role if being updated
        if (req.data.projectRole) {
            if (!['Designing', 'Developing', 'Testing', 'Deployment'].includes(req.data.projectRole)) {
                return req.error(400, 'Project role must be Designing, Developing, Testing, or Deployment');
            }
        }
    });

    // ✅ CHANGE 1: Manager can assign projects to employees
    this.on('assignProjectToEmployee', async (req) => {
        const { employeeID, projectID } = req.data;
        
        const manager = await getAuthenticatedManager(req);
        if (!manager) return 'Manager not found';

        // Verify employee exists and belongs to manager's team
        const employee = await SELECT.one.from(Employees).where({ employeeID });
        if (!employee) {
            return req.error(404, 'Employee not found');
        }

        if (employee.managerID_ID !== manager.ID) {
            return req.error(403, 'You can only assign projects to your team members');
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
            message: `${manager.firstName} ${manager.lastName} assigned you to project: ${project.projectName}`,
            notificationType: 'Project Assignment',
            isRead: false,
            relatedEntity: 'Project',
            relatedEntityID: project.ID
        });

        return `Project ${project.projectName} assigned to ${employee.firstName} ${employee.lastName} successfully`;
    });

    // Action: Approve Timesheet
    this.on('approveTimesheet', async (req) => {
        const { timesheetID } = req.data;
        
        const manager = await getAuthenticatedManager(req);
        if (!manager) return 'Manager not found';
        
        const managerID = manager.ID;

        const timesheet = await SELECT.one.from(Timesheets)
            .columns('*', { ref: ['employee'], expand: ['*'] })
            .where({ timesheetID });

        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        //  Check if employee belongs to this manager's team
        if (timesheet.employee.managerID_ID !== managerID) {
            return req.error(403, 'You can only approve timesheets of your team members');
        }

        if (timesheet.status !== 'Submitted' && timesheet.status !== 'Modified') {
            return req.error(400, 'Only submitted or modified timesheets can be approved');
        }

        await UPDATE(Timesheets)
            .set({
                status: 'Approved',
                approvedBy_ID: managerID,
                approvalDate: new Date().toISOString()
            })
            .where({ ID: timesheet.ID });

        // Send notification to employee
        const notificationCount = await SELECT.from(Notifications);
        await INSERT.into(Notifications).entries({
            notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
            recipient_ID: timesheet.employee_ID,
            message: `Your timesheet for ${timesheet.workDate} has been approved by ${manager.firstName} ${manager.lastName}`,
            notificationType: 'Timesheet Approval',
            isRead: false,
            relatedEntity: 'Timesheet',
            relatedEntityID: timesheet.ID
        });

        return 'Timesheet approved successfully';
    });

    // Action: Reject Timesheet
    this.on('rejectTimesheet', async (req) => {
        const { timesheetID, reason } = req.data;
        
        const manager = await getAuthenticatedManager(req);
        if (!manager) return 'Manager not found';
        
        const managerID = manager.ID;

        const timesheet = await SELECT.one.from(Timesheets)
            .columns('*', { ref: ['employee'], expand: ['*'] })
            .where({ timesheetID });

        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        if (timesheet.employee.managerID_ID !== managerID) {
            return req.error(403, 'You can only reject timesheets of your team members');
        }

        if (timesheet.status !== 'Submitted' && timesheet.status !== 'Modified') {
            return req.error(400, 'Only submitted or modified timesheets can be rejected');
        }

        await UPDATE(Timesheets)
            .set({
                status: 'Rejected',
                taskDetails: `${timesheet.taskDetails || ''}\nManager Feedback: ${reason}`,
                approvedBy_ID: null,
                approvalDate: null
            })
            .where({ ID: timesheet.ID });

        // Send notification to employee
        const notificationCount = await SELECT.from(Notifications);
        await INSERT.into(Notifications).entries({
            notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
            recipient_ID: timesheet.employee_ID,
            message: `Your timesheet for ${timesheet.workDate} has been rejected by ${manager.firstName} ${manager.lastName}. Reason: ${reason}`,
            notificationType: 'Timesheet Rejection',
            isRead: false,
            relatedEntity: 'Timesheet',
            relatedEntityID: timesheet.ID
        });

        return 'Timesheet rejected';
    });

    // After READ notifications - Mark as read
    this.after('READ', 'MyNotifications', async (data, req) => {
        if (Array.isArray(data)) {
            const unreadIds = data.filter(n => !n.isRead).map(n => n.ID);
            if (unreadIds.length > 0) {
                await UPDATE(Notifications).set({ isRead: true }).where({ ID: { in: unreadIds } });
            }
        }
    });
});