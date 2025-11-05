const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
    /// Helper to get and validate user
    const getAuthenticatedEmployee = async (req) => {
        const userId = req.user.id;
        
        if (!userId) {
            req.error(401, 'User not authenticated');
            return null;
        }

        // Check if employee exists in database
        const employee = await SELECT.one.from('my.timesheet.Employees')
            .where({ ID: userId, isActive: true });

        if (!employee) {
            req.error(404, 'Employee profile not found or inactive. Please contact administrator.');
            return null;
        }

        return employee;
    };

    // Helper to calculate date differences
    const calculateDateDiff = (startDate, endDate) => {
        if (!startDate || !endDate) return null;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const calculateDaysRemaining = (endDate) => {
        if (!endDate) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        const diffTime = end - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const getTimelineStatus = (endDate) => {
        const daysRemaining = calculateDaysRemaining(endDate);
        if (daysRemaining === null) return 'Unknown';
        if (daysRemaining < 0) return 'Overdue';
        if (daysRemaining < 7) return 'At Risk';
        return 'On Track';
    };

    // NEW: MyProjects Handler
    this.on('READ', 'MyProjects', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return [];

        const employeeID = employee.ID;

        // Get all timesheets for this employee grouped by project
        const timesheets = await SELECT.from('my.timesheet.Timesheets')
            .where({ employee_ID: employeeID });

        // Group by project and calculate aggregations
        const projectMap = {};
        
        for (const ts of timesheets) {
            if (!ts.project_ID) continue;

            if (!projectMap[ts.project_ID]) {
                // Fetch project details
                const project = await SELECT.one.from('my.timesheet.Projects')
                    .where({ ID: ts.project_ID });
                
                if (!project) continue;

                projectMap[ts.project_ID] = {
                    projectID: project.ID,
                    projectCode: project.projectID,
                    Project: project.projectName,
                    AllocatedHours: project.allocatedHours || 0,
                    BookedHours: 0,
                    RemainingHours: 0,
                    Utilization: 0,
                    status: ts.status,
                    StartDate: project.startDate,
                    EndDate: project.endDate,
                    Duration: calculateDateDiff(project.startDate, project.endDate),
                    DaysRemaining: calculateDaysRemaining(project.endDate),
                    TimelineStatus: getTimelineStatus(project.endDate)
                };
            }

            // Accumulate hours
            projectMap[ts.project_ID].BookedHours += parseFloat(ts.hoursWorked || 0);
            
            // Keep most recent status
            if (ts.status === 'Modified' || ts.status === 'Submitted') {
                projectMap[ts.project_ID].status = ts.status;
            }
        }

        // Calculate remaining hours and utilization
        const projects = Object.values(projectMap).map(p => {
            p.RemainingHours = p.AllocatedHours - p.BookedHours;
            p.Utilization = p.AllocatedHours > 0 
                ? parseFloat(((p.BookedHours / p.AllocatedHours) * 100).toFixed(2))
                : 0;
            return p;
        });

        return projects;
    });

    // ✅ NEW: BookedHoursOverview Handler
    this.on('READ', 'BookedHoursOverview', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return [];

        const employeeID = employee.ID;

        // Get all timesheets for this employee
        const timesheets = await SELECT.from('my.timesheet.Timesheets')
            .where({ employee_ID: employeeID });

        // Group by project
        const projectMap = {};
        
        for (const ts of timesheets) {
            if (!ts.project_ID) continue;

            if (!projectMap[ts.project_ID]) {
                const project = await SELECT.one.from('my.timesheet.Projects')
                    .where({ ID: ts.project_ID });
                
                if (!project) continue;

                projectMap[ts.project_ID] = {
                    projectID: project.ID,
                    Project: project.projectName,
                    AllocatedHours: project.allocatedHours || 0,
                    BookedHours: 0,
                    RemainingHours: 0,
                    Utilization: '0%'
                };
            }

            projectMap[ts.project_ID].BookedHours += parseFloat(ts.hoursWorked || 0);
        }

        // Calculate remaining and utilization
        const overview = Object.values(projectMap).map(p => {
            p.RemainingHours = p.AllocatedHours - p.BookedHours;
            const util = p.AllocatedHours > 0 
                ? ((p.BookedHours / p.AllocatedHours) * 100).toFixed(1)
                : 0;
            p.Utilization = `${util}%`;
            return p;
        });

        return overview;
    });

    // ✅ NEW: ProjectEngagementDuration Handler
    this.on('READ', 'ProjectEngagementDuration', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return [];

        const employeeID = employee.ID;

        // Get unique projects for this employee
        const timesheets = await SELECT.from('my.timesheet.Timesheets')
            .columns('project_ID')
            .where({ employee_ID: employeeID });

        const projectIDs = [...new Set(timesheets.map(ts => ts.project_ID).filter(id => id))];

        const projects = [];
        for (const projectID of projectIDs) {
            const project = await SELECT.one.from('my.timesheet.Projects')
                .where({ ID: projectID });
            
            if (!project) continue;

            projects.push({
                projectID: project.ID,
                Project: project.projectName,
                StartDate: project.startDate,
                EndDate: project.endDate,
                Duration: calculateDateDiff(project.startDate, project.endDate),
                DaysRemaining: calculateDaysRemaining(project.endDate),
                TimelineStatus: getTimelineStatus(project.endDate)
            });
        }

        return projects;
    });

    //  employee access before any READ operations
    this.before('READ', 'MyProfile', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) {
            req.reject(404, 'Employee not found');
        }
    });

    this.before('READ', 'MyTimesheets', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) {
            req.reject(404, 'Employee not found');
        }
    });

    this.before('READ', 'AvailableActivities', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) {
            req.reject(404, 'Employee not found');
        }
    });

    // Before CREATE - Validate timesheet entry
    this.before('CREATE', 'MyTimesheets', async (req) => {
        const { workDate, hoursWorked, activity_ID, nonProjectType_ID, isBillable } = req.data;
        
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return;

        const employeeID = employee.ID;

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
            if (activity.status !== 'Active') {
                return req.error(400, 'This activity is not active');
            }
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

        req.data.employee_ID = employeeID;
        req.data.status = req.data.status || 'Draft';
    });

    // After CREATE - Generate timesheet ID
    this.after('CREATE', 'MyTimesheets', async (data, req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return;
        
        const employeeID = employee.ID;
        const count = await SELECT.from('my.timesheet.Timesheets').where({ employee_ID: employeeID });
        const timesheetID = `TS${String(count.length + 1).padStart(4, '0')}`;
        await UPDATE('my.timesheet.Timesheets').set({ timesheetID }).where({ ID: data.ID });
    });

    // Before UPDATE - Check if timesheet is approved
    this.before('UPDATE', 'MyTimesheets', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return;

        const timesheetInternalID = req.data.ID;
        if (!timesheetInternalID) return;

        const timesheet = await SELECT.one.from('my.timesheet.Timesheets').where({ ID: timesheetInternalID });

        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        if (timesheet.employee_ID !== employee.ID) {
            return req.error(403, 'You can only update your own timesheets');
        }

        if (timesheet.status === 'Approved') {
            req.data.status = 'Modified';
        }

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

    // After UPDATE - Send notifications
    this.after('UPDATE', 'MyTimesheets', async (data, req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return;

        const timesheet = await SELECT.one.from('my.timesheet.Timesheets')
            .where({ ID: data.ID });

        if (timesheet && timesheet.status === 'Modified') {
            const notificationCount = await SELECT.from('my.timesheet.Notifications');
            
            if (employee.managerID_ID) {
                await INSERT.into('my.timesheet.Notifications').entries({
                    notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
                    recipient_ID: employee.managerID_ID,
                    message: `${employee.firstName} ${employee.lastName} modified previously approved timesheet for ${timesheet.workDate}`,
                    notificationType: 'Timesheet Modified',
                    isRead: false,
                    relatedEntity: 'Timesheet',
                    relatedEntityID: timesheet.ID
                });
            }

            const admins = await SELECT.from('my.timesheet.Employees')
                .columns('ID', 'userRole_ID')
                .where({ isActive: true });
            
            for (const adminUser of admins) {
                const role = await SELECT.one.from('my.timesheet.UserRoles')
                    .where({ ID: adminUser.userRole_ID });
                
                if (role && role.roleName === 'Admin') {
                    await INSERT.into('my.timesheet.Notifications').entries({
                        notificationID: `NOT${String(notificationCount.length + 2).padStart(4, '0')}`,
                        recipient_ID: adminUser.ID,
                        message: `${employee.firstName} ${employee.lastName} modified previously approved timesheet for ${timesheet.workDate}`,
                        notificationType: 'Timesheet Modified',
                        isRead: false,
                        relatedEntity: 'Timesheet',
                        relatedEntityID: timesheet.ID
                    });
                }
            }
        }
    });

    // Action: Submit Timesheet
    this.on('submitTimesheet', async (req) => {
        const { timesheetID } = req.data;
        
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return 'Employee not found';
        
        const employeeID = employee.ID;

        const timesheet = await SELECT.one.from('my.timesheet.Timesheets')
            .where({ timesheetID, employee_ID: employeeID });

        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        if (timesheet.status !== 'Draft' && timesheet.status !== 'Modified') {
            return req.error(400, 'Only draft or modified timesheets can be submitted');
        }

        await UPDATE('my.timesheet.Timesheets').set({ status: 'Submitted' }).where({ ID: timesheet.ID });

        if (employee.managerID_ID) {
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
        
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return 'Employee not found';
        
        const employeeID = employee.ID;

        const timesheet = await SELECT.one.from('my.timesheet.Timesheets')
            .where({ timesheetID, employee_ID: employeeID });

        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        const updateData = {};
        if (hours !== undefined) updateData.hoursWorked = hours;
        if (taskDetails !== undefined) updateData.taskDetails = taskDetails;
        
        if (timesheet.status === 'Approved') {
            updateData.status = 'Modified';
        }

        await UPDATE('my.timesheet.Timesheets').set(updateData).where({ ID: timesheet.ID });

        return 'Timesheet updated successfully';
    });

    // Function: Validate Daily Hours
    this.on('validateDailyHours', async (req) => {
        const { date } = req.data;
        
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return 0;
        
        const employeeID = employee.ID;

        const timesheets = await SELECT.from('my.timesheet.Timesheets')
            .where({ employee_ID: employeeID, workDate: date });
       
        let totalHours = 0;
        timesheets.forEach(entry => {
            totalHours += parseFloat(entry.hoursWorked || 0);
        });

        return totalHours;
    });

    // Before DELETE timesheet
    this.before('DELETE', 'MyTimesheets', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return;

        const timesheet = await SELECT.one.from('my.timesheet.Timesheets').where({ ID: req.data.ID });
        
        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        if (timesheet.employee_ID !== employee.ID) {
            return req.error(403, 'You can only delete your own timesheets');
        }
        
        if (timesheet.status === 'Approved') {
            return req.error(400, 'Cannot delete approved timesheets');
        }
    });
});