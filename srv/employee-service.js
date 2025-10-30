const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
    // Helper to get user ID
    const getUserId = (req) => {
        return req.user.id;
    };

    // Before CREATE - Validate timesheet entry
    this.before('CREATE', 'MyTimesheets', async (req) => {
        const { workDate, hoursWorked, activity_ID, nonProjectType_ID, isBillable } = req.data;
        const employeeID = getUserId(req);

        if (!employeeID) {
            return req.error(401, 'User not authenticated');
        }

        // Validate hours worked - now allows up to 15 hours
        const hoursNum = parseFloat(hoursWorked);
        if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 15) {
            return req.error(400, 'Hours worked must be between 0 and 15');
        }

        // Get current date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const workDateObj = new Date(workDate);
        if (isNaN(workDateObj)) {
            return req.error(400, 'Invalid work date');
        }
        workDateObj.setHours(0, 0, 0, 0);

        // Validation 1: Cannot book billable hours for future weeks
        if (isBillable && workDateObj > today) {
            const daysDiff = Math.floor((workDateObj - today) / (1000 * 60 * 60 * 24));
            if (daysDiff > 7) {
                return req.error(400, 'Cannot book billable hours for future weeks. Only non-project activities can be booked for future.');
            }
        }

        // Validation 2: Check if activity exists (if provided)
        if (activity_ID) {
            const activity = await SELECT.one.from('my.timesheet.Activities').where({ ID: activity_ID });
            if (!activity) {
                return req.error(404, 'Activity not found');
            }
            // Set project from activity if exists
            req.data.project_ID = activity.project_ID || null;
        }

        // Validation 3: Check if non-project type exists (if provided)
        if (nonProjectType_ID) {
            const nonProjectType = await SELECT.one.from('my.timesheet.NonProjectTypes').where({ ID: nonProjectType_ID });
            if (!nonProjectType) {
                return req.error(404, 'Non-Project Type not found');
            }
            if (!nonProjectType.isActive) {
                return req.error(400, 'This non-project type is not active');
            }
        }

        // Validation 4: Check total hours for the day (must not exceed 15)
        const existingTimesheets = await SELECT.from('my.timesheet.Timesheets')
            .where({ employee_ID: employeeID, workDate: workDate });
       
        let totalHours = hoursNum;
        existingTimesheets.forEach(entry => {
            totalHours += parseFloat(entry.hoursWorked || 0);
        });

        if (totalHours > 15) {
            return req.error(400, `Total hours for ${workDate} cannot exceed 15 hours. Current total: ${totalHours.toFixed(2)}`);
        }

        // Validation 5: For past dates, total hours should equal or approach 8 (standard working day)
        if (workDateObj < today && totalHours < 7) {
            return req.error(400, `Total booked hours for past dates should be close to 8 hours. Current total: ${totalHours.toFixed(2)}`);
        }

        // Set employee ID and status
        req.data.employee_ID = employeeID;
        req.data.status = req.data.status || 'Draft';
    });

    // After CREATE - Generate timesheet ID
    this.after('CREATE', 'MyTimesheets', async (data, req) => {
        const employeeID = getUserId(req);
        const count = await SELECT.from('my.timesheet.Timesheets').where({ employee_ID: employeeID });
        const timesheetID = `TS${String(count.length + 1).padStart(4, '0')}`;
        await UPDATE('my.timesheet.Timesheets').set({ timesheetID }).where({ ID: data.ID });
    });

    // Before UPDATE - Check if timesheet is approved
    this.before('UPDATE', 'MyTimesheets', async (req) => {
        const timesheetInternalID = req.data.ID;
        if (!timesheetInternalID) return;

        const timesheet = await SELECT.one.from('my.timesheet.Timesheets').where({ ID: timesheetInternalID });

        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        // Cannot update approved timesheets
        if (timesheet.status === 'Approved') {
            return req.error(400, 'Cannot update approved timesheets. Contact your manager.');
        }

        // Validate hours again if being updated - allow up to 15 hours
        if (req.data.hoursWorked !== undefined) {
            const newHours = parseFloat(req.data.hoursWorked);
            if (isNaN(newHours) || newHours <= 0 || newHours > 15) {
                return req.error(400, 'Hours worked must be between 0 and 15');
            }

            const workDate = timesheet.workDate;
            const existingTimesheets = await SELECT.from('my.timesheet.Timesheets')
                .where({ employee_ID: timesheet.employee_ID, workDate: workDate, ID: { '!=': timesheetInternalID } });
           
            let totalHours = newHours;
            existingTimesheets.forEach(entry => {
                totalHours += parseFloat(entry.hoursWorked || 0);
            });

            if (totalHours > 15) {
                return req.error(400, `Total hours for ${workDate} cannot exceed 15 hours.`);
            }
        }
    });

    // Action: Submit Timesheet
    this.on('submitTimesheet', async (req) => {
        const { timesheetID } = req.data;
        const employeeID = getUserId(req);

        const timesheet = await SELECT.one.from('my.timesheet.Timesheets')
            .where({ timesheetID, employee_ID: employeeID });

        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        if (timesheet.status !== 'Draft') {
            return req.error(400, 'Only draft timesheets can be submitted');
        }

        await UPDATE('my.timesheet.Timesheets').set({ status: 'Submitted' }).where({ ID: timesheet.ID });

        // Send notification to manager
        const employee = await SELECT.one.from('my.timesheet.Employees').where({ ID: employeeID });
       
        if (employee && employee.managerID_ID) {
            const notificationCount = await SELECT.from('my.timesheet.Notifications');
            await INSERT.into('my.timesheet.Notifications').entries({
                notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
                recipient_ID: employee.managerID_ID,
                message: `${employee.firstName} ${employee.lastName} submitted timesheet for ${timesheet.workDate}`,
                notificationType: 'Timesheet Submission',
                isRead: false,
                relatedEntity: 'Timesheet',
                relatedEntityID: timesheet.ID
            });
        }

        return 'Timesheet submitted successfully';
    });

    // Action: Update Timesheet
    this.on('updateTimesheet', async (req) => {
        const { timesheetID, hours, taskDetails } = req.data;
        const employeeID = getUserId(req);

        const timesheet = await SELECT.one.from('my.timesheet.Timesheets')
            .where({ timesheetID, employee_ID: employeeID });

        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        if (timesheet.status === 'Approved') {
            return req.error(400, 'Cannot update approved timesheets');
        }

        const updateData = {};
        if (hours !== undefined) updateData.hoursWorked = hours;
        if (taskDetails !== undefined) updateData.taskDetails = taskDetails;

        await UPDATE('my.timesheet.Timesheets').set(updateData).where({ ID: timesheet.ID });

        return 'Timesheet updated successfully';
    });

    // Function: Validate Daily Hours
    this.on('validateDailyHours', async (req) => {
        const { date } = req.data;
        const employeeID = getUserId(req);

        if (!employeeID) return 0;

        // Get all timesheets for the date
        const timesheets = await SELECT.from('my.timesheet.Timesheets')
            .where({ employee_ID: employeeID, workDate: date });
       
        let totalHours = 0;
        timesheets.forEach(entry => {
            totalHours += parseFloat(entry.hoursWorked || 0);
        });

        return totalHours;
    });

    // Before DELETE timesheet - Prevent deleting approved timesheets
    this.before('DELETE', 'MyTimesheets', async (req) => {
        const timesheet = await SELECT.one.from('my.timesheet.Timesheets').where({ ID: req.data.ID });
        
        if (timesheet && timesheet.status === 'Approved') {
            return req.error(400, 'Cannot delete approved timesheets');
        }
    });
});