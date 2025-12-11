const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
    const { Employees, Projects, Timesheets, Notifications } = this.entities;


    const getAuthenticatedManager = async (req) => {
        const userId = req.user.id;
        
        console.log('Manager Auth - User ID from BTP:', userId);
        
        if (!userId) {
            req.error(401, 'User not authenticated');
            return null;
        }

        let manager = await SELECT.one.from('my.timesheet.Employees')
            .where({ email: userId, isActive: true });

        if (!manager && !userId.includes('@')) {
            console.log('User ID is not an email, trying with @sumodigitech.com domain...');
            const emailWithDomain = `${userId}@sumodigitech.com`;
            manager = await SELECT.one.from('my.timesheet.Employees')
                .where({ email: emailWithDomain, isActive: true });
        }

        if (!manager) {
            console.log('Trying case-insensitive email search...');
            const allEmployees = await SELECT.from('my.timesheet.Employees')
                .where({ isActive: true });
            
            const userEmail = userId.toLowerCase();
            manager = allEmployees.find(emp => 
                emp.email && emp.email.toLowerCase() === userEmail
            );
        }

        if (!manager) {
            console.log('Manager profile not found for email:', userId);
            req.error(404, 'Manager profile not found or inactive. Please contact administrator.');
            return null;
        }

        if (manager.userRole_ID) {
            const role = await SELECT.one.from('my.timesheet.UserRoles')
                .where({ ID: manager.userRole_ID });
            
            console.log('User role:', role ? role.roleName : 'None');
            
            if (role && role.roleName !== 'Manager') {
                console.log(' User does not have Manager role');
                req.error(403, 'Access denied. Manager role required.');
                return null;
            }
        } else {
            console.log('User has no role assigned');
            req.error(403, 'Access denied. No role assigned.');
            return null;
        }

        console.log('Manager authenticated:', manager.employeeID, 'Email:', manager.email);
        return manager;
    };

    this.on('READ', 'MyManagerProfile', async (req) => {
        const manager = await getAuthenticatedManager(req);
        if (!manager) return [];

        const managerProfile = await SELECT.one.from('my.timesheet.Employees')
            .where({ ID: manager.ID });

        if (!managerProfile) return [];

        if (managerProfile.userRole_ID) {
            const role = await SELECT.one.from('my.timesheet.UserRoles')
                .columns('roleName', 'roleID', 'description')
                .where({ ID: managerProfile.userRole_ID });
            
            if (role) {
                managerProfile.roleName = role.roleName;
                managerProfile.roleID = role.roleID;
                managerProfile.roleDescription = role.description;
            }
        }

        if (managerProfile.managerID_ID) {
            const seniorManager = await SELECT.one.from('my.timesheet.Employees')
                .columns('firstName', 'lastName', 'email')
                .where({ ID: managerProfile.managerID_ID });
            
            if (seniorManager) {
                managerProfile.managerName = `${seniorManager.firstName} ${seniorManager.lastName}`;
                managerProfile.managerEmail = seniorManager.email;
            }
        }

        console.log('MyManagerProfile enriched with roleName:', managerProfile.roleName);
        return [managerProfile];
    });

this.on('READ', 'MyNotifications', async (req) => {
    console.log('📧 Manager Notifications READ - Enhanced');
    
    const manager = await getAuthenticatedManager(req);
    if (!manager) return [];

    const managerID = manager.ID;

    const notifications = await SELECT.from('my.timesheet.Notifications')
        .where({ recipient_ID: managerID })
        .orderBy('createdAt desc');

    for (const notif of notifications) {
        notif.recipientName = `${manager.firstName} ${manager.lastName}`;

        if (notif.relatedEntity === 'Timesheet' && notif.relatedEntityID) {
            const timesheet = await SELECT.one.from('my.timesheet.Timesheets')
                .columns('timesheetID', 'weekStartDate', 'weekEndDate', 'status', 'employee_ID')
                .where({ ID: notif.relatedEntityID });
            
            if (timesheet) {
                const employee = await SELECT.one.from('my.timesheet.Employees')
                    .columns('firstName', 'lastName', 'employeeID')
                    .where({ ID: timesheet.employee_ID });
                
                if (employee) {
                    notif.relatedDetails = `Timesheet ${timesheet.timesheetID} - Employee: ${employee.firstName} ${employee.lastName} (${employee.employeeID}) - Week: ${timesheet.weekStartDate} to ${timesheet.weekEndDate} - Status: ${timesheet.status}`;
                }
            }
        } else if (notif.relatedEntity === 'Project' && notif.relatedEntityID) {
            const project = await SELECT.one.from('my.timesheet.Projects')
                .columns('projectID', 'projectName', 'status')
                .where({ ID: notif.relatedEntityID });
            
            if (project) {
                notif.relatedDetails = `Project: ${project.projectName} (${project.projectID}) - Status: ${project.status}`;
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

    console.log('Manager Notifications enriched:', notifications.length);
    return notifications;
});


this.after('READ', 'MyNotifications', async (data, req) => {
    if (Array.isArray(data) && data.length > 0) {
        const unreadIds = data.filter(n => !n.isRead).map(n => n.ID);
        if (unreadIds.length > 0) {
            await UPDATE('my.timesheet.Notifications')
                .set({ isRead: true })
                .where({ ID: { in: unreadIds } });
            
            console.log(`Marked ${unreadIds.length} notifications as read`);
        }
    }
});

    this.before('READ', ['MyTeam', 'MyProjects', 'TeamTimesheets'], async (req) => {
        const manager = await getAuthenticatedManager(req);
        if (!manager) {
            req.reject(403, 'Manager not found or access denied');
        }
    });

 
    this.before('CREATE', 'MyProjects', async (req) => {
        const manager = await getAuthenticatedManager(req);
        if (!manager) return;
        
        const managerID = manager.ID;

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

        if (req.data.isBillable === undefined) {
            req.data.isBillable = true;
        }
    });

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

        if (req.data.projectRole) {
            if (!['Designing', 'Developing', 'Testing', 'Deployment'].includes(req.data.projectRole)) {
                return req.error(400, 'Project role must be Designing, Developing, Testing, or Deployment');
            }
        }
    });

    this.before('DELETE', 'MyProjects', async (req) => {
        const manager = await getAuthenticatedManager(req);
        if (!manager) return;
        
        const projectID = req.data.ID;
        const managerID = manager.ID;

        console.log('Manager attempting to delete project:', projectID);

        const project = await SELECT.one.from(Projects).where({ ID: projectID });
        if (!project) {
            return req.error(404, 'Project not found');
        }

        if (project.projectOwner_ID !== managerID) {
            return req.error(403, 'You can only delete your own projects');
        }

        const timesheets = await SELECT.from('my.timesheet.Timesheets')
            .where({ project_ID: projectID });

        if (timesheets.length > 0) {
            return req.error(400, 
                `Cannot delete project with ${timesheets.length} existing timesheet(s). ` +
                `Please consider marking the project as inactive instead.`
            );
        }

        const assignments = await SELECT.from('my.timesheet.ProjectAssignments')
            .where({ project_ID: projectID, isActive: true });

        if (assignments.length > 0) {
            return req.error(400, 
                `Cannot delete project with ${assignments.length} active assignment(s). ` +
                `Please unassign employees first or mark project as inactive.`
            );
        }

        console.log('Project can be deleted - no dependencies found');
    });


this.on('READ', 'ProjectSummary', async (req) => {
    console.log('ProjectSummary READ - Enhanced with timeline metrics');
    
    const manager = await getAuthenticatedManager(req);
    if (!manager) return [];

    const managerID = manager.ID;

    const projects = await SELECT.from('my.timesheet.Projects')
        .where({ projectOwner_ID: managerID });

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

        let projectStatus = 'On Track';
        if (remainingDays < 0) {
            projectStatus = 'Delayed';
        } else if (project.status === 'Completed') {
            projectStatus = 'Completed';
        } else if (project.status === 'On Hold') {
            projectStatus = 'On Hold';
        }

        summaryData.push({
            projectID: project.ID,
            projID: project.projectID,
            projectName: project.projectName,
            projectRole: project.projectRole,
            allocatedHours: project.allocatedHours || 0,
            startDate: project.startDate,
            endDate: project.endDate,
            duration: duration,
            remainingDays: remainingDays,
            status: projectStatus
        });
    }

    console.log('ProjectSummary generated for', summaryData.length, 'projects');
    return summaryData;
});

  

this.on('READ', 'TeamProgressReport', async (req) => {
    console.log('TeamProgressReport READ - Enhanced with utilization metrics');
    
    const manager = await getAuthenticatedManager(req);
    if (!manager) return [];

    const managerID = manager.ID;


    const teamMembers = await SELECT.from('my.timesheet.Employees')
        .where({ managerID_ID: managerID, isActive: true });

    const reportData = [];

    for (const employee of teamMembers) {

        const projectAssignments = await SELECT.from('my.timesheet.ProjectAssignments')
            .where({ employee_ID: employee.ID, isActive: true });

        for (const assignment of projectAssignments) {
            const project = await SELECT.one.from('my.timesheet.Projects')
                .where({ ID: assignment.project_ID });

            if (!project) continue;

            const allocatedHours = project.allocatedHours || 0;

            const employeeTimesheets = await SELECT.from('my.timesheet.Timesheets')
                .where({ employee_ID: employee.ID, project_ID: project.ID });

            let bookedHours = 0;
            for (const ts of employeeTimesheets) {
                bookedHours += parseFloat(ts.totalWeekHours || 0);
            }

            const remainingHours = allocatedHours - bookedHours;

            const utilization = allocatedHours > 0 
                ? parseFloat(((bookedHours / allocatedHours) * 100).toFixed(2))
                : 0;

            reportData.push({
                ID: `${employee.ID}_${project.ID}`,
                empID: employee.employeeID,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                projectID: project.ID,
                projID: project.projectID,
                projectName: project.projectName,
                projectRole: project.projectRole,
                allocatedHours: allocatedHours,
                bookedHours: parseFloat(bookedHours.toFixed(2)),
                remainingHours: parseFloat(remainingHours.toFixed(2)),
                utilization: utilization
            });
        }
    }

    console.log('TeamProgressReport generated for', reportData.length, 'assignments');
    return reportData;
});

    this.on('assignProjectToEmployee', async (req) => {
        const { employeeID, projectID } = req.data;
        
        console.log('🔧 Manager assignProjectToEmployee called:', { employeeID, projectID });
        
        const manager = await getAuthenticatedManager(req);
        if (!manager) return 'Manager not found';

        const employee = await SELECT.one.from('my.timesheet.Employees').where({ employeeID });
        if (!employee) {
            return req.error(404, 'Employee not found');
        }

        if (employee.managerID_ID !== manager.ID) {
            return req.error(403, 'You can only assign projects to your team members');
        }

        const project = await SELECT.one.from('my.timesheet.Projects').where({ projectID });
        if (!project) {
            return req.error(404, 'Project not found');
        }

        const existingAssignment = await SELECT.one
            .from('my.timesheet.ProjectAssignments')
            .where({ employee_ID: employee.ID, project_ID: project.ID, isActive: true });

        if (existingAssignment) {
            return req.error(400, `Employee is already assigned to project ${project.projectName}`);
        }

        await INSERT.into('my.timesheet.ProjectAssignments').entries({
            employee_ID: employee.ID,
            project_ID: project.ID,
            assignedBy_ID: manager.ID,
            assignedDate: new Date().toISOString(),
            isActive: true
        });

        console.log(`Created ProjectAssignment: ${employee.employeeID} → ${project.projectID}`);

        const existingTimesheet = await SELECT.from('my.timesheet.Timesheets')
            .where({ employee_ID: employee.ID, project_ID: project.ID });

        if (existingTimesheet.length === 0) {

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
            
            const employeeTimesheets = await SELECT.from('my.timesheet.Timesheets')
                .where({ employee_ID: employee.ID });
            const timesheetID = `TS${String(employeeTimesheets.length + 1).padStart(4, '0')}`;
            
            await INSERT.into('my.timesheet.Timesheets').entries({
                timesheetID: timesheetID,
                employee_ID: employee.ID,
                project_ID: project.ID,
                weekStartDate: weekStartStr,
                weekEndDate: weekEndStr,
                task: 'Developing',
                taskDetails: `Assigned to ${project.projectName} by manager`,
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

       const notificationCount = await SELECT.from('my.timesheet.Notifications');
await INSERT.into('my.timesheet.Notifications').entries({
    notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
    recipient_ID: employee.ID,
    message: `Your manager ${manager.firstName} ${manager.lastName} has assigned you to project "${project.projectName}" (${project.projectID}). You can now log hours for this project in your timesheet.`,
    notificationType: 'Project Assignment',
    isRead: false,
    relatedEntity: 'Project',
    relatedEntityID: project.ID
});

        return `Project ${project.projectName} assigned to ${employee.firstName} ${employee.lastName} successfully`;
    });

    this.on('approveTimesheet', async (req) => {
        const { timesheetID } = req.data;
        
        console.log('Approve timesheet called for:', timesheetID);
        
        const manager = await getAuthenticatedManager(req);
        if (!manager) return 'Manager not found';
        
        const managerID = manager.ID;

        if (!timesheetID) {
            return req.error(400, 'Timesheet ID is required');
        }

        const timesheet = await SELECT.one.from('my.timesheet.Timesheets')
            .where({ timesheetID });

        if (!timesheet) {
            return req.error(404, `Timesheet ${timesheetID} not found`);
        }

        const employee = await SELECT.one.from('my.timesheet.Employees')
            .where({ ID: timesheet.employee_ID });

        if (!employee) {
            return req.error(404, 'Employee not found for this timesheet');
        }


        if (employee.managerID_ID !== managerID) {
            return req.error(403, 'You can only approve timesheets of your team members');
        }


        if (timesheet.status !== 'Submitted' && timesheet.status !== 'Modified') {
            return req.error(400, `Only Submitted or Modified timesheets can be approved. Current status: ${timesheet.status}`);
        }


        await UPDATE('my.timesheet.Timesheets')
            .set({
                status: 'Approved',
                approvedBy_ID: managerID,
                approvalDate: new Date().toISOString()
            })
            .where({ ID: timesheet.ID });

        console.log(`Timesheet ${timesheetID} approved by manager ${manager.employeeID}`);


       const notificationCount = await SELECT.from('my.timesheet.Notifications');
await INSERT.into('my.timesheet.Notifications').entries({
    notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
    recipient_ID: timesheet.employee_ID,
    message: `Your timesheet ${timesheetID} for week ${timesheet.weekStartDate} to ${timesheet.weekEndDate} has been APPROVED by your manager ${manager.firstName} ${manager.lastName}. Total hours: ${timesheet.totalWeekHours}`,
    notificationType: 'Timesheet Approval',
    isRead: false,
    relatedEntity: 'Timesheet',
    relatedEntityID: timesheet.ID
});
        return `Timesheet ${timesheetID} for week ${timesheet.weekStartDate} approved successfully`;
    });


    this.on('rejectTimesheet', async (req) => {
        const { timesheetID, reason } = req.data;
        
        console.log('Reject timesheet called for:', timesheetID);
        
        const manager = await getAuthenticatedManager(req);
        if (!manager) return 'Manager not found';
        
        const managerID = manager.ID;

        if (!timesheetID) {
            return req.error(400, 'Timesheet ID is required');
        }

        if (!reason || reason.trim() === '') {
            return req.error(400, 'Rejection reason is required');
        }


        const timesheet = await SELECT.one.from('my.timesheet.Timesheets')
            .where({ timesheetID });

        if (!timesheet) {
            return req.error(404, `Timesheet ${timesheetID} not found`);
        }


        const employee = await SELECT.one.from('my.timesheet.Employees')
            .where({ ID: timesheet.employee_ID });

        if (!employee) {
            return req.error(404, 'Employee not found for this timesheet');
        }

        if (employee.managerID_ID !== managerID) {
            return req.error(403, 'You can only reject timesheets of your team members');
        }

        if (timesheet.status !== 'Submitted' && timesheet.status !== 'Modified') {
            return req.error(400, `Only Submitted or Modified timesheets can be rejected. Current status: ${timesheet.status}`);
        }


        await UPDATE('my.timesheet.Timesheets')
            .set({
                status: 'Rejected',
                taskDetails: `${timesheet.taskDetails || ''}\n\n[REJECTION FEEDBACK - ${new Date().toISOString().split('T')[0]}]\nManager: ${manager.firstName} ${manager.lastName}\nReason: ${reason}`,
                approvedBy_ID: managerID,
                approvalDate: new Date().toISOString()
            })
            .where({ ID: timesheet.ID });

        console.log(`Timesheet ${timesheetID} rejected by manager ${manager.employeeID}`);


       const notificationCount = await SELECT.from('my.timesheet.Notifications');
await INSERT.into('my.timesheet.Notifications').entries({
    notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
    recipient_ID: timesheet.employee_ID,
    message: `Your timesheet ${timesheetID} for week ${timesheet.weekStartDate} to ${timesheet.weekEndDate} has been REJECTED by your manager ${manager.firstName} ${manager.lastName}. Reason: ${reason}. Please review and resubmit with corrections.`,
    notificationType: 'Timesheet Rejection',
    isRead: false,
    relatedEntity: 'Timesheet',
    relatedEntityID: timesheet.ID
});

        return `Timesheet ${timesheetID} for week ${timesheet.weekStartDate} rejected. Reason: ${reason}`;
    });

 
    this.after('READ', 'MyNotifications', async (data, req) => {
        if (Array.isArray(data)) {
            const unreadIds = data.filter(n => !n.isRead).map(n => n.ID);
            if (unreadIds.length > 0) {
                await UPDATE('my.timesheet.Notifications').set({ isRead: true }).where({ ID: { in: unreadIds } });
            }
        }
    });
});