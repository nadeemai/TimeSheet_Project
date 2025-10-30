const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
    const { Employees, Projects, Timesheets, Notifications } = this.entities;

    // Before READ - Ensure manager can only see their team's data
    this.before('READ', 'TeamTimesheets', async (req) => {
        const managerID = req.user.id;
        // Additional validation if needed - framework handles WHERE clause via service definition
    });

    // Before CREATE Project - Automatically assign to manager and validate project role
    this.before('CREATE', 'MyProjects', async (req) => {
        const managerID = req.user.id;
       
        const manager = await SELECT.one.from(Employees).where({ ID: managerID });
        if (!manager) {
            return req.error(403, 'Manager profile not found');
        }

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
        const projectID = req.data.ID;
        const managerID = req.user.id;

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

    // Action: Approve Timesheet
    this.on('approveTimesheet', async (req) => {
        const { timesheetID } = req.data;
        const managerID = req.user.id;

        const timesheet = await SELECT.one.from(Timesheets)
            .columns('*', { ref: ['employee'], expand: ['*'] })
            .where({ timesheetID });

        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        if (timesheet.employee.managerID_ID !== managerID) {
            return req.error(403, 'You can only approve timesheets of your team members');
        }

        if (timesheet.status !== 'Submitted') {
            return req.error(400, 'Only submitted timesheets can be approved');
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
            message: `Your timesheet for ${timesheet.workDate} has been approved`,
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
        const managerID = req.user.id;

        const timesheet = await SELECT.one.from(Timesheets)
            .columns('*', { ref: ['employee'], expand: ['*'] })
            .where({ timesheetID });

        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        if (timesheet.employee.managerID_ID !== managerID) {
            return req.error(403, 'You can only reject timesheets of your team members');
        }

        if (timesheet.status !== 'Submitted') {
            return req.error(400, 'Only submitted timesheets can be rejected');
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
            message: `Your timesheet for ${timesheet.workDate} has been rejected. Reason: ${reason}`,
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