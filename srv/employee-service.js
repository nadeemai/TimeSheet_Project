const cds = require('@sap/cds');
const { 
  notifyTimesheetModification,
  notifyNonProjectRequest 
} = require('./email_service');

module.exports = cds.service.impl(async function() {
    const { 
        Employees, 
        Projects, 
        Timesheets, 
        Notifications,
        Activities,
        NonProjectTypes,
        LeaveTypes,           
        EmployeeLeaveBalance 
    } = this.entities;

    const { Readable } = require('stream');

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

   const getAuthenticatedEmployee = async (req) => {
    const userId = req.user.id;
    
    console.log('🔍 Employee Auth - User ID from BTP:', userId);
    
    if (!userId) {
        req.error(401, 'User not authenticated');
        return null;
    }

   
    let employee = await SELECT.one.from('my.timesheet.Employees')
        .where({ email: userId, isActive: true });


    if (!employee && !userId.includes('@')) {
        console.log('⚠️ User ID is not an email, trying with @sumodigitech.com domain...');
        const emailWithDomain = `${userId}@sumodigitech.com`;
        employee = await SELECT.one.from('my.timesheet.Employees')
            .where({ email: emailWithDomain, isActive: true });
    }

    if (!employee) {
        console.log('⚠️ Trying case-insensitive email search...');
        const allEmployees = await SELECT.from('my.timesheet.Employees')
            .where({ isActive: true });
        
        const userEmail = userId.toLowerCase();
        employee = allEmployees.find(emp => 
            emp.email && emp.email.toLowerCase() === userEmail
        );
    }

    if (!employee) {
        console.log('Employee not found for email:', userId);
        req.error(404, 'Employee profile not found or inactive. Please contact administrator.');
        return null;
    }

    console.log('Employee authenticated:', employee.employeeID, 'Email:', employee.email);
    return employee;
};

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

    const getWeekBoundaries = (date) => {
        const inputDate = date ? new Date(date) : new Date();

        if (isNaN(inputDate.getTime())) {
            throw new Error(`Invalid date passed to getWeekBoundaries: ${date}`);
        }

        const dayOfWeek = inputDate.getDay();

        const monday = new Date(inputDate);
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        monday.setDate(inputDate.getDate() + daysToMonday);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        return {
            weekStart: monday.toISOString().split('T')[0],
            weekEnd: sunday.toISOString().split('T')[0]
        };
    };

    const getWeekDates = (weekStart) => {
        const monday = new Date(weekStart);
        const days = [];
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            days.push({
                date: date.toISOString().split('T')[0],
                day: dayNames[i]
            });
        }
        
        return days;
    };


const getOrCreateLeaveBalance = async (employeeID, leaveTypeID, year) => {
    let balance = await SELECT.one
        .from('my.timesheet.EmployeeLeaveBalance')
        .where({ employee_ID: employeeID, leaveType_ID: leaveTypeID, year: year });
    
    if (!balance) {

        await INSERT.into('my.timesheet.EmployeeLeaveBalance').entries({
            employee_ID: employeeID,
            leaveType_ID: leaveTypeID,
            year: year,
            totalLeaves: 10,
            usedLeaves: 0,
            remainingLeaves: 10
        });
        
        balance = await SELECT.one
            .from('my.timesheet.EmployeeLeaveBalance')
            .where({ employee_ID: employeeID, leaveType_ID: leaveTypeID, year: year });
        
        console.log(`Created leave balance for employee ${employeeID}, leave type ${leaveTypeID}, year ${year}`);
    }
    
    return balance;
};


const updateLeaveBalance = async (employeeID, leaveTypeID, year, hoursUsed) => {
    const daysUsed = hoursUsed / 8; 
    
    const balance = await getOrCreateLeaveBalance(employeeID, leaveTypeID, year);
    
    const newUsedLeaves = parseFloat(balance.usedLeaves || 0) + daysUsed;
    const newRemainingLeaves = parseFloat(balance.totalLeaves || 10) - newUsedLeaves;
    
    await UPDATE('my.timesheet.EmployeeLeaveBalance')
        .set({
            usedLeaves: newUsedLeaves,
            remainingLeaves: newRemainingLeaves
        })
        .where({ 
            employee_ID: employeeID, 
            leaveType_ID: leaveTypeID, 
            year: year 
        });
    
    console.log(`Updated leave balance: Used ${daysUsed} days, Remaining: ${newRemainingLeaves}`);
    
    return { usedLeaves: newUsedLeaves, remainingLeaves: newRemainingLeaves };
};

const validateLeaveAvailability = async (employeeID, leaveTypeID, year, hoursRequested) => {
    const balance = await getOrCreateLeaveBalance(employeeID, leaveTypeID, year);
    
    const daysRequested = hoursRequested / 8;
    const remainingLeaves = parseFloat(balance.remainingLeaves || 10);
    
    if (daysRequested > remainingLeaves) {
        return {
            valid: false,
            message: `Insufficient leave balance. Requested: ${daysRequested} days, Available: ${remainingLeaves} days`
        };
    }
    
    return { valid: true, message: 'Leave available' };
};

this.on('READ', 'MyTimesheets', async (req) => {
    console.log('📊 MyTimesheets READ - Start');
    console.log('📊 User ID:', req.user.id);
    
    const employee = await getAuthenticatedEmployee(req);
    if (!employee) {
        console.log('❌ Employee not found, returning empty array');
        return [];
    }

    console.log('✅ Employee found:', employee.employeeID, 'ID:', employee.ID);

    try {
        const timesheets = await SELECT.from('my.timesheet.Timesheets')
            .where({ employee_ID: employee.ID });

        console.log('📋 Found timesheets:', timesheets.length);
        
        if (timesheets.length === 0) {
            console.log('⚠️ No timesheets found for employee');
            return [];
        }
        
for (const ts of timesheets) {
    ts.employee_ID = employee.ID;
    ts.employeeName = `${employee.firstName} ${employee.lastName}`;
    
    if (ts.project_ID) {
        console.log('🔍 Enriching project for ID:', ts.project_ID);
        

        let project = await SELECT.one
            .from('my.timesheet.Projects')
            .where({ ID: ts.project_ID });
        

        if (!project && typeof ts.project_ID === 'string' && !ts.project_ID.includes('-')) {
            console.log('⚠️ Trying projectID code lookup');
            project = await SELECT.one
                .from('my.timesheet.Projects')
                .where({ projectID: ts.project_ID });
            

            if (project) {
                ts.project_ID = project.ID;
            }
        }
        
        if (project) {
            ts.projectName = project.projectName;
            ts.projectRole = project.projectRole;
            console.log(`Enriched timesheet ${ts.timesheetID} with project: ${project.projectName}`);
        } else {
            console.log(`Project not found for ID: ${ts.project_ID}`);
            ts.projectName = null;
            ts.projectRole = null;
        }
    } else {
        ts.projectName = null;
        ts.projectRole = null;
        console.log(`📝 Timesheet ${ts.timesheetID} has no project (non-project activity)`);
    }
    

    if (ts.activity_ID) {
        const activity = await SELECT.one
            .from('my.timesheet.Activities')
            .where({ ID: ts.activity_ID });
        
        if (activity) {
            ts.activityName = activity.activity;
        } else {
            ts.activityName = null;
        }
    } else {
        ts.activityName = null;
    }
    
    if (ts.nonProjectType_ID) {
        const npt = await SELECT.one
            .from('my.timesheet.NonProjectTypes')
            .where({ ID: ts.nonProjectType_ID });
        
        if (npt) {
            ts.nonProjectTypeName = npt.typeName;
            ts.nonProjectTypeID = npt.nonProjectTypeID;
        } else {
            ts.nonProjectTypeName = null;
            ts.nonProjectTypeID = null;
        }
    } else {
        ts.nonProjectTypeName = null;
        ts.nonProjectTypeID = null;
    }
    

    if (ts.approvedBy_ID) {
        const approver = await SELECT.one
            .from('my.timesheet.Employees')
            .where({ ID: ts.approvedBy_ID });
        
        if (approver) {
            ts.approvedByName = `${approver.firstName} ${approver.lastName}`;
        } else {
            ts.approvedByName = null;
        }
    } else {
        ts.approvedByName = null;
    }
}
        
        console.log('Successfully enriched all timesheets');
        return timesheets;
        
    } catch (error) {
        console.error('Error in MyTimesheets READ:', error);
        console.error('Stack trace:', error.stack);
        return [];
    }
});

this.on('READ', 'AvailableLeaveTypes', async (req) => {
    const employee = await getAuthenticatedEmployee(req);
    if (!employee) return [];

    console.log('📋 AvailableLeaveTypes READ - Start');

    const leaveTypes = await SELECT.from('my.timesheet.LeaveTypes')
        .where({ isActive: true })
        .orderBy('leaveTypeID asc');

    console.log('Found', leaveTypes.length, 'active leave types');
    return leaveTypes;
});

this.on('READ', 'MyLeaveBalance', async (req) => {
    const employee = await getAuthenticatedEmployee(req);
    if (!employee) return [];

    console.log('📊 MyLeaveBalance READ - Start for employee:', employee.employeeID);

    const employeeID = employee.ID;
    const currentYear = new Date().getFullYear();

    const leaveTypes = await SELECT.from('my.timesheet.LeaveTypes')
        .where({ isActive: true });

    const balances = [];

    for (const leaveType of leaveTypes) {
        let balance = await SELECT.one
            .from('my.timesheet.EmployeeLeaveBalance')
            .where({ 
                employee_ID: employeeID, 
                leaveType_ID: leaveType.ID, 
                year: currentYear 
            });

        if (!balance) {
            await INSERT.into('my.timesheet.EmployeeLeaveBalance').entries({
                employee_ID: employeeID,
                leaveType_ID: leaveType.ID,
                year: currentYear,
                totalLeaves: 10,
                usedLeaves: 0,
                remainingLeaves: 10
            });

            balance = await SELECT.one
                .from('my.timesheet.EmployeeLeaveBalance')
                .where({ 
                    employee_ID: employeeID, 
                    leaveType_ID: leaveType.ID, 
                    year: currentYear 
                });

            console.log(`Created leave balance for ${leaveType.typeName}`);
        }

        balances.push({
            ID: balance.ID,
            employee_ID: employeeID,
            employeeCode: employee.employeeID,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            leaveType_ID: leaveType.ID,
            leaveTypeCode: leaveType.leaveTypeID,
            leaveTypeName: leaveType.typeName,
            defaultHours: leaveType.defaultHours,
            year: currentYear,
            totalLeaves: balance.totalLeaves || 10,
            usedLeaves: balance.usedLeaves || 0,
            remainingLeaves: balance.remainingLeaves || 10
        });
    }

    console.log('MyLeaveBalance returning', balances.length, 'leave types');
    return balances;
});

this.on('CREATE', 'MyTimesheets', async (req) => {
    console.log('🔧 === Full CREATE MyTimesheets Handler START ===');
    console.log('🔧 User:', req.user && req.user.id);
    
    const employee = await getAuthenticatedEmployee(req);
    if (!employee) return req.reject(401, 'Employee not authenticated');

    const employeeID = employee.ID;
    const payload = Object.assign({}, req.data);

    const leaveTypes = ['Personal Leave', 'Sick Leave', 'Half Day Leave'];
    const isLeaveRequest = leaveTypes.includes(payload.task);
    const validProjectTasks = ['Designing', 'Developing', 'Testing', 'Bug Fix', 'Deployment', 'Client Call'];
    
    if (!isLeaveRequest && payload.task && !validProjectTasks.includes(payload.task)) {
        return req.error(400, `Invalid task type. Must be one of: ${validProjectTasks.join(', ')} or a leave type`);
    }

    // ✅ If it's a leave request, validate leave type and balance
    if (isLeaveRequest) {
        if (!payload.leaveType_ID) {
            return req.error(400, 'Leave Type is required when requesting leave.');
        }

        const leaveType = await SELECT.one
            .from('my.timesheet.LeaveTypes')
            .where({ ID: payload.leaveType_ID });

        if (!leaveType) {
            return req.error(404, 'Leave Type not found');
        }

        if (!leaveType.isActive) {
            return req.error(400, 'This leave type is not active');
        }

        // Ensure task matches leave type name
        if (payload.task !== leaveType.typeName) {
            payload.task = leaveType.typeName;
        }

        console.log('✅ Leave type:', leaveType.typeName, 'Default hours:', leaveType.defaultHours);

        // Calculate total leave hours
        const totalLeaveHours = 
            parseFloat(payload.mondayHours || 0) +
            parseFloat(payload.tuesdayHours || 0) +
            parseFloat(payload.wednesdayHours || 0) +
            parseFloat(payload.thursdayHours || 0) +
            parseFloat(payload.fridayHours || 0) +
            parseFloat(payload.saturdayHours || 0) +
            parseFloat(payload.sundayHours || 0);

        // Validate leave balance
        const currentYear = new Date().getFullYear();
        const leaveValidation = await validateLeaveAvailability(
            employeeID, 
            leaveType.ID, 
            currentYear, 
            totalLeaveHours
        );

        if (!leaveValidation.valid) {
            return req.error(400, leaveValidation.message);
        }

        console.log('✅ Leave validation passed');
    }

    // Set week boundaries
    const inputDateForWeek = payload.date || payload.weekStartDate || new Date().toISOString().split('T')[0];
    let weekBoundaries;
    try {
        weekBoundaries = getWeekBoundaries(inputDateForWeek);
    } catch (e) {
        console.error('❌ Invalid date for week boundaries:', inputDateForWeek, e);
        return req.error(400, `Invalid date provided for week calculation: ${inputDateForWeek}`);
    }
    const weekDates = getWeekDates(weekBoundaries.weekStart);

    payload.weekStartDate = weekBoundaries.weekStart;
    payload.weekEndDate = weekBoundaries.weekEnd;

    payload.mondayDate = weekDates[0].date; payload.mondayDay = weekDates[0].day;
    payload.tuesdayDate = weekDates[1].date; payload.tuesdayDay = weekDates[1].day;
    payload.wednesdayDate = weekDates[2].date; payload.wednesdayDay = weekDates[2].day;
    payload.thursdayDate = weekDates[3].date; payload.thursdayDay = weekDates[3].day;
    payload.fridayDate = weekDates[4].date; payload.fridayDay = weekDates[4].day;
    payload.saturdayDate = weekDates[5].date; payload.saturdayDay = weekDates[5].day;
    payload.sundayDate = weekDates[6].date; payload.sundayDay = weekDates[6].day;

    payload.mondayHours = payload.mondayHours || 0;
    payload.tuesdayHours = payload.tuesdayHours || 0;
    payload.wednesdayHours = payload.wednesdayHours || 0;
    payload.thursdayHours = payload.thursdayHours || 0;
    payload.fridayHours = payload.fridayHours || 0;
    payload.saturdayHours = payload.saturdayHours || 0;
    payload.sundayHours = payload.sundayHours || 0;

    payload.mondayTaskDetails = payload.mondayTaskDetails || '';
    payload.tuesdayTaskDetails = payload.tuesdayTaskDetails || '';
    payload.wednesdayTaskDetails = payload.wednesdayTaskDetails || '';
    payload.thursdayTaskDetails = payload.thursdayTaskDetails || '';
    payload.fridayTaskDetails = payload.fridayTaskDetails || '';
    payload.saturdayTaskDetails = payload.saturdayTaskDetails || '';
    payload.sundayTaskDetails = payload.sundayTaskDetails || '';

    payload.totalWeekHours =
        parseFloat(payload.mondayHours || 0) +
        parseFloat(payload.tuesdayHours || 0) +
        parseFloat(payload.wednesdayHours || 0) +
        parseFloat(payload.thursdayHours || 0) +
        parseFloat(payload.fridayHours || 0) +
        parseFloat(payload.saturdayHours || 0) +
        parseFloat(payload.sundayHours || 0);

    // Validate daily limits
    const dayChecks = [
        { day: 'Monday', hours: payload.mondayHours, details: payload.mondayTaskDetails },
        { day: 'Tuesday', hours: payload.tuesdayHours, details: payload.tuesdayTaskDetails },
        { day: 'Wednesday', hours: payload.wednesdayHours, details: payload.wednesdayTaskDetails },
        { day: 'Thursday', hours: payload.thursdayHours, details: payload.thursdayTaskDetails },
        { day: 'Friday', hours: payload.fridayHours, details: payload.fridayTaskDetails },
        { day: 'Saturday', hours: payload.saturdayHours, details: payload.saturdayTaskDetails },
        { day: 'Sunday', hours: payload.sundayHours, details: payload.sundayTaskDetails }
    ];
    
    for (const d of dayChecks) {
        if (d.hours > 15) return req.error(400, `${d.day} hours cannot exceed 15. Current: ${d.hours}`);
        if (d.hours > 0 && (!d.details || d.details.trim() === '')) {
            return req.error(400, `${d.day}: Task details are required when hours are entered.`);
        }
    }

    // Validate project requirement
    if (!payload.project_ID && !isLeaveRequest && !payload.nonProjectType_ID) {
        return req.error(400, 'Project is required for project-related tasks. Please select a project or choose leave.');
    }

    // Activity validation
    if (payload.activity_ID) {
        const activity = await SELECT.one.from('my.timesheet.Activities').where({ ID: payload.activity_ID });
        if (!activity) return req.error(404, 'Activity not found');
        if (activity.status !== 'Active') return req.error(400, 'This activity is not active');
        payload.project_ID = activity.project_ID || null;
    }
    
    // Non-project type validation
    if (payload.nonProjectType_ID) {
        const npt = await SELECT.one.from('my.timesheet.NonProjectTypes').where({ ID: payload.nonProjectType_ID });
        if (!npt) return req.error(404, 'Non-Project Type not found');
        if (!npt.isActive) return req.error(400, 'This non-project type is not active');
    }

    payload.employee_ID = employeeID;
    payload.status = 'Submitted';

    // Generate timesheet ID
    if (!payload.timesheetID) {
        const existingForEmployee = await SELECT.from('my.timesheet.Timesheets').where({ employee_ID: employeeID });
        payload.timesheetID = `TS${String(existingForEmployee.length + 1).padStart(4, '0')}`;
        console.log('✅ Generated timesheetID:', payload.timesheetID);
    }

    // Check for duplicates
    const dupWhere = {
        employee_ID: employeeID,
        weekStartDate: payload.weekStartDate,
        task: payload.task // This will include leave type name
    };
    if (payload.project_ID) dupWhere.project_ID = payload.project_ID;
    if (payload.leaveType_ID) dupWhere.leaveType_ID = payload.leaveType_ID;

    const existing = await SELECT.from('my.timesheet.Timesheets').where(dupWhere);
    if (existing.length > 0) {
        return req.error(400, `A timesheet entry for this task already exists for week starting ${payload.weekStartDate}. Please update the existing entry instead.`);
    }

    // Perform INSERT
    try {
        await INSERT.into('my.timesheet.Timesheets').entries(payload);
        
        const created = await SELECT.one.from('my.timesheet.Timesheets')
            .where({ timesheetID: payload.timesheetID, employee_ID: employeeID });

        if (!created) {
            console.error('❌ Insert reported success but SELECT could not find the created row.');
            return req.error(500, 'Failed to verify created timesheet.');
        }

        // ✅ If it's a leave request, update leave balance
        if (isLeaveRequest && created.leaveType_ID) {
            const currentYear = new Date().getFullYear();
            await updateLeaveBalance(
                employeeID, 
                created.leaveType_ID, 
                currentYear, 
                created.totalWeekHours
            );

            console.log('✅ Leave balance updated');

            // Send notification to manager
            if (employee.managerID_ID) {
                const leaveType = await SELECT.one
                    .from('my.timesheet.LeaveTypes')
                    .where({ ID: created.leaveType_ID });

                const notificationCount = await SELECT.from('my.timesheet.Notifications');
                
                const totalDays = (created.totalWeekHours / 8).toFixed(1);
                
                await INSERT.into('my.timesheet.Notifications').entries({
                    notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
                    recipient_ID: employee.managerID_ID,
                    message: `${employee.firstName} ${employee.lastName} has requested ${leaveType.typeName} for ${totalDays} day(s) (Week: ${created.weekStartDate} to ${created.weekEndDate}). Total hours: ${created.totalWeekHours}. Please review and approve/reject.`,
                    notificationType: 'Leave Request',
                    isRead: false,
                    relatedEntity: 'Timesheet',
                    relatedEntityID: created.ID
                });

                console.log('✅ Leave request notification sent to manager');
            }
        }

        // Enrich response with related data
        if (created.project_ID) {
            const project = await SELECT.one.from('my.timesheet.Projects').columns('projectName','projectRole').where({ ID: created.project_ID });
            if (project) { 
                created.projectName = project.projectName; 
                created.projectRole = project.projectRole; 
            } else {
                created.projectName = null;
                created.projectRole = null;
            }
        } else {
            created.projectName = null;
            created.projectRole = null;
        }

        if (created.employee_ID) {
            const emp = await SELECT.one.from('my.timesheet.Employees').columns('firstName','lastName','employeeID').where({ ID: created.employee_ID });
            if (emp) {
                created.employeeName = `${emp.firstName} ${emp.lastName}`;
            } else {
                created.employeeName = null;
            }
        } else {
            created.employeeName = null;
        }

        if (created.activity_ID) {
            const act = await SELECT.one.from('my.timesheet.Activities').columns('activity').where({ ID: created.activity_ID });
            if (act) {
                created.activityName = act.activity;
            } else {
                created.activityName = null;
            }
        } else {
            created.activityName = null;
        }

        if (created.nonProjectType_ID) {
            const npt = await SELECT.one.from('my.timesheet.NonProjectTypes').columns('typeName', 'nonProjectTypeID').where({ ID: created.nonProjectType_ID });
            if (npt) {
                created.nonProjectTypeName = npt.typeName;
                created.nonProjectTypeID = npt.nonProjectTypeID;
            } else {
                created.nonProjectTypeName = null;
                created.nonProjectTypeID = null;
            }
        } else {
            created.nonProjectTypeName = null;
            created.nonProjectTypeID = null;
        }

        // ✅ Enrich with leave type info
        if (created.leaveType_ID) {
            const leaveType = await SELECT.one.from('my.timesheet.LeaveTypes')
                .columns('typeName', 'leaveTypeID', 'defaultHours')
                .where({ ID: created.leaveType_ID });
            
            if (leaveType) {
                created.leaveTypeName = leaveType.typeName;
                created.leaveTypeCode = leaveType.leaveTypeID;
                created.leaveDefaultHours = leaveType.defaultHours;
            } else {
                created.leaveTypeName = null;
                created.leaveTypeCode = null;
                created.leaveDefaultHours = null;
            }
        } else {
            created.leaveTypeName = null;
            created.leaveTypeCode = null;
            created.leaveDefaultHours = null;
        }

        try { req._.res.set('location', `MyTimesheets(${created.ID})`); } catch(e) { /* ignore */ }

        console.log('🔧 === Full CREATE MyTimesheets Handler END ===');
        console.log('✅ Created timesheet with task:', created.task);
        
        return created;

    } catch (err) {
        console.error('❌ Error performing explicit INSERT:', err);
        return req.error(500, 'Failed to create timesheet');
    }
});

this.on('READ', 'MyProjects', async (req) => {
    const employee = await getAuthenticatedEmployee(req);
    if (!employee) return [];

    console.log('📊 MyProjects READ - Showing ALL active projects for employee:', employee.employeeID);

    const employeeID = employee.ID;

    const allProjects = await SELECT.from('my.timesheet.Projects')
        .where({ status: 'Active' });

    console.log('📋 Found active projects:', allProjects.length);

    if (allProjects.length === 0) {
        console.log('⚠️ No active projects in the system');
        return [];
    }

    for (const project of allProjects) {
        if (project.projectOwner_ID) {
            const owner = await SELECT.one
                .from('my.timesheet.Employees')
                .columns('firstName', 'lastName')
                .where({ ID: project.projectOwner_ID });
            
            if (owner) {
                project.projectOwnerName = `${owner.firstName} ${owner.lastName}`;
            }
        }
        const projectTimesheets = await SELECT.from('my.timesheet.Timesheets')
            .where({ employee_ID: employeeID, project_ID: project.ID });
        
        let bookedHours = 0;
        for (const ts of projectTimesheets) {
            bookedHours += parseFloat(ts.totalWeekHours || 0);
        }

        project.BookedHours = bookedHours;
        project.RemainingHours = (project.allocatedHours || 0) - bookedHours;
        project.Utilization = project.allocatedHours > 0 
            ? parseFloat(((bookedHours / project.allocatedHours) * 100).toFixed(2))
            : 0;
    }

    console.log('MyProjects returning:', allProjects.length, 'projects');
    return allProjects;
});

this.on('READ', 'AssignedProjectsList', async (req) => {
    const employee = await getAuthenticatedEmployee(req);
    if (!employee) return [];

    console.log('📋 AssignedProjectsList - Showing ALL active projects');


    const projects = await SELECT.from('my.timesheet.Projects')
        .columns('ID', 'projectID', 'projectName', 'projectRole', 'status')
        .where({ status: 'Active' });

    console.log('Found', projects.length, 'active projects for dropdown');
    return projects;
});


this.on('READ', 'BookedHoursOverview', async (req) => {
    const employee = await getAuthenticatedEmployee(req);
    if (!employee) return [];

    const employeeID = employee.ID;

    const allProjects = await SELECT.from('my.timesheet.Projects')
        .where({ status: 'Active' });

    const overview = [];

    for (const project of allProjects) {

        const timesheets = await SELECT.from('my.timesheet.Timesheets')
            .where({ employee_ID: employeeID, project_ID: project.ID });

        let bookedHours = 0;
        for (const ts of timesheets) {
            bookedHours += parseFloat(ts.totalWeekHours || 0);
        }

        // Only include projects the employee has worked on OR all projects (your choice)
        // Option 1: Only show projects employee worked on
        // if (bookedHours > 0) {
        
        // Option 2: Show ALL projects (even with 0 hours)
        const remainingHours = (project.allocatedHours || 0) - bookedHours;
        const util = project.allocatedHours > 0 
            ? ((bookedHours / project.allocatedHours) * 100).toFixed(1)
            : 0;

        overview.push({
            projectID: project.ID,
            Project: project.projectName,
            AllocatedHours: project.allocatedHours || 0,
            BookedHours: bookedHours,
            RemainingHours: remainingHours,
            Utilization: `${util}%`
        });
        // }
    }

    return overview;
});
    // ProjectEngagementDuration Handler
    this.on('READ', 'ProjectEngagementDuration', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return [];

        const employeeID = employee.ID;

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

    // AvailableTaskTypes Handler
    this.on('READ', 'AvailableTaskTypes', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return [];

        return [
            {
                code: 'Designing',
                name: 'Designing',
                description: 'UI/UX design, wireframing, mockups, prototyping',
                isProjectTask: true,
            },
            {
                code: 'Developing',
                name: 'Developing',
                description: 'Writing code, implementing features, building functionality',
                isProjectTask: true,
            },
            {
                code: 'Testing',
                name: 'Testing',
                description: 'QA testing, test execution, test case creation',
                isProjectTask: true,
            },
            {
                code: 'Bug Fix',
                name: 'Bug Fix',
                description: 'Fixing defects, resolving issues, debugging',
                isProjectTask: true,
            },
            {
                code: 'Deployment',
                name: 'Deployment',
                description: 'Release activities, CI/CD, production releases',
                isProjectTask: true,
            },
            {
                code: 'Client Call',
                name: 'Client Call',
                description: 'Client meetings, stakeholder communication, demos',
                isProjectTask: true,
            },
        ];
    });

    // Employee access validation
    this.before('READ', 'MyProfile', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) {
            req.reject(404, 'Employee not found');
        }
    });

    // this.before('READ', 'MyTimesheets', async (req) => {
    //     const employee = await getAuthenticatedEmployee(req);
    //     if (!employee) {
    //         req.reject(404, 'Employee not found');
    //     }
    // });

    this.before('READ', 'AvailableActivities', async (req) => {
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) {
            req.reject(404, 'Employee not found');
        }
    });

this.before('CREATE', 'MyTimesheets', async (req) => {
    const employee = await getAuthenticatedEmployee(req);
    if (!employee) return;

    const employeeID = employee.ID;
    const { task, project_ID, activity_ID, nonProjectType_ID, leaveType_ID } = req.data;

    // ✅ NEW: If BOTH nonProjectType_ID AND leaveType_ID are provided
    // This means: User selected "Leave" from NonProjectType, then selected specific leave type
    if (nonProjectType_ID && leaveType_ID) {
        console.log('🍃 Processing leave request with both NonProjectType and LeaveType');
        
        // Validate NonProjectType is "Leave"
        const nonProjectType = await SELECT.one
            .from('my.timesheet.NonProjectTypes')
            .where({ ID: nonProjectType_ID });

        if (!nonProjectType) {
            return req.error(404, 'Non-Project Type not found');
        }

        if (!nonProjectType.isActive) {
            return req.error(400, 'This non-project type is not active');
        }

        // Verify it's the "Leave" type
        if (nonProjectType.typeName !== 'Leave') {
            return req.error(400, 'NonProjectType must be "Leave" when using LeaveType');
        }

        console.log('✅ NonProjectType validated: Leave');

        // Fetch the specific leave type
        const leaveType = await SELECT.one
            .from('my.timesheet.LeaveTypes')
            .where({ ID: leaveType_ID });

        if (!leaveType) {
            return req.error(404, 'Leave Type not found');
        }

        if (!leaveType.isActive) {
            return req.error(400, 'This leave type is not active');
        }

        // ✅ STORE LEAVE TYPE NAME IN TASK FIELD
        req.data.task = leaveType.typeName; // "Personal Leave", "Sick Leave", or "Half Day Leave"
        
        console.log('✅ Leave type stored in task field:', leaveType.typeName);
        console.log('✅ NonProjectType remains:', nonProjectType.typeName);

        // Validate leave balance
        const totalLeaveHours = 
            parseFloat(req.data.mondayHours || 0) +
            parseFloat(req.data.tuesdayHours || 0) +
            parseFloat(req.data.wednesdayHours || 0) +
            parseFloat(req.data.thursdayHours || 0) +
            parseFloat(req.data.fridayHours || 0) +
            parseFloat(req.data.saturdayHours || 0) +
            parseFloat(req.data.sundayHours || 0);

        const currentYear = new Date().getFullYear();
        const leaveValidation = await validateLeaveAvailability(
            employeeID, 
            leaveType.ID, 
            currentYear, 
            totalLeaveHours
        );

        if (!leaveValidation.valid) {
            return req.error(400, leaveValidation.message);
        }

        console.log('✅ Leave validation passed');
    }
    // ✅ If only leaveType_ID (without nonProjectType_ID) - also support this
    else if (leaveType_ID && !nonProjectType_ID) {
        const leaveType = await SELECT.one
            .from('my.timesheet.LeaveTypes')
            .where({ ID: leaveType_ID });

        if (!leaveType) {
            return req.error(404, 'Leave Type not found');
        }

        if (!leaveType.isActive) {
            return req.error(400, 'This leave type is not active');
        }

        // Store leave type name in task field
        req.data.task = leaveType.typeName;
        
        console.log('✅ Leave type stored in task field (without NonProjectType):', leaveType.typeName);
    }

    // Validate task for project work
    const validProjectTasks = ['Designing', 'Developing', 'Testing', 'Bug Fix', 'Deployment', 'Client Call'];
    const leaveTypeNames = ['Personal Leave', 'Sick Leave', 'Half Day Leave'];
    
    // Allow task if it's a valid project task OR a leave type name
    if (task && !leaveType_ID && !validProjectTasks.includes(task) && !leaveTypeNames.includes(task)) {
        return req.error(400, `Invalid task type. Must be one of: ${validProjectTasks.join(', ')}`);
    }

    // Convert project code to UUID if needed
    if (project_ID) {
        const isUUID = project_ID.includes('-');
        
        if (!isUUID) {
            console.log('⚠️ Converting project code to UUID:', project_ID);
            const project = await SELECT.one
                .from('my.timesheet.Projects')
                .columns('ID')
                .where({ projectID: project_ID });
            
            if (!project) {
                return req.error(404, `Project with code ${project_ID} not found`);
            }
            
            req.data.project_ID = project.ID;
            console.log('✅ Converted to UUID:', project.ID);
        }
    }

    // Set week boundaries
    const inputDateForWeek = req.data.date || req.data.weekStartDate || new Date().toISOString().split('T')[0];
    let weekBoundaries;
    try {
        weekBoundaries = getWeekBoundaries(inputDateForWeek);
    } catch (e) {
        console.error('❌ Invalid date for week boundaries:', inputDateForWeek, e);
        return req.error(400, `Invalid date provided for week calculation: ${inputDateForWeek}`);
    }
    const weekDates = getWeekDates(weekBoundaries.weekStart);
   
    req.data.weekStartDate = weekBoundaries.weekStart;
    req.data.weekEndDate   = weekBoundaries.weekEnd;

    req.data.mondayDate    = weekDates[0].date;
    req.data.mondayDay     = weekDates[0].day;
    req.data.tuesdayDate   = weekDates[1].date;
    req.data.tuesdayDay    = weekDates[1].day;
    req.data.wednesdayDate = weekDates[2].date;
    req.data.wednesdayDay  = weekDates[2].day;
    req.data.thursdayDate  = weekDates[3].date;
    req.data.thursdayDay   = weekDates[3].day;
    req.data.fridayDate    = weekDates[4].date;
    req.data.fridayDay     = weekDates[4].day;
    req.data.saturdayDate  = weekDates[5].date;
    req.data.saturdayDay   = weekDates[5].day;
    req.data.sundayDate    = weekDates[6].date;
    req.data.sundayDay     = weekDates[6].day;

    // Default hours
    req.data.mondayHours = req.data.mondayHours || 0;
    req.data.tuesdayHours = req.data.tuesdayHours || 0;
    req.data.wednesdayHours = req.data.wednesdayHours || 0;
    req.data.thursdayHours = req.data.thursdayHours || 0;
    req.data.fridayHours = req.data.fridayHours || 0;
    req.data.saturdayHours = req.data.saturdayHours || 0;
    req.data.sundayHours = req.data.sundayHours || 0;

    req.data.mondayTaskDetails = req.data.mondayTaskDetails || '';
    req.data.tuesdayTaskDetails = req.data.tuesdayTaskDetails || '';
    req.data.wednesdayTaskDetails = req.data.wednesdayTaskDetails || '';
    req.data.thursdayTaskDetails = req.data.thursdayTaskDetails || '';
    req.data.fridayTaskDetails = req.data.fridayTaskDetails || '';
    req.data.saturdayTaskDetails = req.data.saturdayTaskDetails || '';
    req.data.sundayTaskDetails = req.data.sundayTaskDetails || '';

    // Calculate total hours
    req.data.totalWeekHours =
        parseFloat(req.data.mondayHours || 0) +
        parseFloat(req.data.tuesdayHours || 0) +
        parseFloat(req.data.wednesdayHours || 0) +
        parseFloat(req.data.thursdayHours || 0) +
        parseFloat(req.data.fridayHours || 0) +
        parseFloat(req.data.saturdayHours || 0) +
        parseFloat(req.data.sundayHours || 0);

    // Validate daily hours
    const dailyHours = [
        { day: 'Monday', hours: req.data.mondayHours },
        { day: 'Tuesday', hours: req.data.tuesdayHours },
        { day: 'Wednesday', hours: req.data.wednesdayHours },
        { day: 'Thursday', hours: req.data.thursdayHours },
        { day: 'Friday', hours: req.data.fridayHours },
        { day: 'Saturday', hours: req.data.saturdayHours },
        { day: 'Sunday', hours: req.data.sundayHours }
    ];

    for (const day of dailyHours) {
        if (day.hours > 15) {
            return req.error(400, `${day.day} hours cannot exceed 15. Current: ${day.hours}`);
        }
    }

    // Validate task details
    const dailyData = [
        { day: 'Monday', hours: req.data.mondayHours, details: req.data.mondayTaskDetails },
        { day: 'Tuesday', hours: req.data.tuesdayHours, details: req.data.tuesdayTaskDetails },
        { day: 'Wednesday', hours: req.data.wednesdayHours, details: req.data.wednesdayTaskDetails },
        { day: 'Thursday', hours: req.data.thursdayHours, details: req.data.thursdayTaskDetails },
        { day: 'Friday', hours: req.data.fridayHours, details: req.data.fridayTaskDetails },
        { day: 'Saturday', hours: req.data.saturdayHours, details: req.data.saturdayTaskDetails },
        { day: 'Sunday', hours: req.data.sundayHours, details: req.data.sundayTaskDetails }
    ];

    for (const dayData of dailyData) {
        if (dayData.hours > 0 && (!dayData.details || dayData.details.trim() === '')) {
            return req.error(400, `${dayData.day}: Task details are required when hours are entered.`);
        }
    }

    // Check for duplicates
    const whereClause = {
        employee_ID: employeeID,
        task: req.data.task,
        weekStartDate: weekBoundaries.weekStart
    };

    if (project_ID) {
        whereClause.project_ID = project_ID;
        
        const projectExists = await SELECT.one
            .from('my.timesheet.Projects')
            .where({ ID: project_ID, status: 'Active' });
        
        if (!projectExists) {
            return req.error(404, 'Project not found or is not active.');
        }
    } else if (!leaveType_ID && !nonProjectType_ID) {
        return req.error(400, 'Project or Leave is required.');
    }

    const existing = await SELECT.from('my.timesheet.Timesheets').where(whereClause);
    if (existing.length > 0) {
        return req.error(400, `A timesheet entry for this task already exists for week starting ${weekBoundaries.weekStart}.`);
    }

    // Handle activity
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

    req.data.employee_ID = employeeID;
    req.data.status = 'Submitted';

    // Generate timesheet ID
    if (!req.data.timesheetID) {
        const employeeTimesheets = await SELECT.from('my.timesheet.Timesheets').where({ employee_ID: employeeID });
        req.data.timesheetID = `TS${String(employeeTimesheets.length + 1).padStart(4, '0')}`;
        console.log('✅ Generated timesheetID:', req.data.timesheetID);
    }
});

this.after('CREATE', 'MyTimesheets', async (result, req) => {
    console.log('🔧 After CREATE - Start enrichment');

    try {

        
        console.log('After CREATE - Enrichment complete, returning enriched timesheet');
        
 
        if (timesheet.nonProjectType_ID && !timesheet.project_ID) {
            console.log('📧 Non-project timesheet CREATED - checking for email notification');
            
            try {

                const employee = await SELECT.one
                    .from('my.timesheet.Employees')
                    .columns('ID', 'employeeID', 'firstName', 'lastName', 'email', 'managerID_ID')
                    .where({ ID: timesheet.employee_ID });

                if (employee && employee.managerID_ID) {
                    // Get non-project type details
                    const nonProjectType = await SELECT.one
                        .from('my.timesheet.NonProjectTypes')
                        .columns('typeName', 'nonProjectTypeID', 'description')
                        .where({ ID: timesheet.nonProjectType_ID });

                    if (nonProjectType) {
                        // Get manager details
                        const manager = await SELECT.one
                            .from('my.timesheet.Employees')
                            .columns('email', 'firstName', 'lastName')
                            .where({ ID: employee.managerID_ID });

                        if (manager && manager.email) {
                            console.log('📧 Sending non-project request email to manager:', manager.email);
                            
                            const totalDays = (timesheet.totalWeekHours / 8).toFixed(1);
                            
                            const emailResult = await notifyNonProjectRequest({
                                employeeName: `${employee.firstName} ${employee.lastName}`,
                                employeeID: employee.employeeID,
                                requestType: nonProjectType.typeName,
                                requestTypeID: nonProjectType.nonProjectTypeID,
                                weekStartDate: timesheet.weekStartDate,
                                weekEndDate: timesheet.weekEndDate,
                                totalHours: timesheet.totalWeekHours || 0,
                                totalDays: totalDays,
                                taskDetails: timesheet.taskDetails || 'No additional details provided',
                                managerEmail: manager.email
                            });

                            if (emailResult && emailResult.success) {
                                console.log('✅✅✅ NON-PROJECT EMAIL SENT (CREATE) ✅✅✅');
                                console.log('   Message ID:', emailResult.messageId);
                            } else {
                                console.error('❌ Failed to send non-project email:', emailResult?.error);
                            }
                        }
                    }
                }
            } catch (emailError) {
                console.error('❌ Error sending non-project email:', emailError);
            }
        }
        
        return timesheet;

    } catch (error) {
        console.error('❌ Error in after CREATE enrichment:', error);
        return req.data || {};
    }
});


    // Before UPDATE - Recalculate total hours
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

        if (req.data.mondayHours !== undefined || req.data.tuesdayHours !== undefined ||
            req.data.wednesdayHours !== undefined || req.data.thursdayHours !== undefined ||
            req.data.fridayHours !== undefined || req.data.saturdayHours !== undefined ||
            req.data.sundayHours !== undefined) {
            
            req.data.totalWeekHours = 
                parseFloat(req.data.mondayHours !== undefined ? req.data.mondayHours : timesheet.mondayHours || 0) +
                parseFloat(req.data.tuesdayHours !== undefined ? req.data.tuesdayHours : timesheet.tuesdayHours || 0) +
                parseFloat(req.data.wednesdayHours !== undefined ? req.data.wednesdayHours : timesheet.wednesdayHours || 0) +
                parseFloat(req.data.thursdayHours !== undefined ? req.data.thursdayHours : timesheet.thursdayHours || 0) +
                parseFloat(req.data.fridayHours !== undefined ? req.data.fridayHours : timesheet.fridayHours || 0) +
                parseFloat(req.data.saturdayHours !== undefined ? req.data.saturdayHours : timesheet.saturdayHours || 0) +
                parseFloat(req.data.sundayHours !== undefined ? req.data.sundayHours : timesheet.sundayHours || 0);

            const hoursToCheck = [
                { day: 'Monday', hours: req.data.mondayHours !== undefined ? req.data.mondayHours : timesheet.mondayHours },
                { day: 'Tuesday', hours: req.data.tuesdayHours !== undefined ? req.data.tuesdayHours : timesheet.tuesdayHours },
                { day: 'Wednesday', hours: req.data.wednesdayHours !== undefined ? req.data.wednesdayHours : timesheet.wednesdayHours },
                { day: 'Thursday', hours: req.data.thursdayHours !== undefined ? req.data.thursdayHours : timesheet.thursdayHours },
                { day: 'Friday', hours: req.data.fridayHours !== undefined ? req.data.fridayHours : timesheet.fridayHours },
                { day: 'Saturday', hours: req.data.saturdayHours !== undefined ? req.data.saturdayHours : timesheet.saturdayHours },
                { day: 'Sunday', hours: req.data.sundayHours !== undefined ? req.data.sundayHours : timesheet.sundayHours }
            ];

            for (const day of hoursToCheck) {
                if (day.hours > 15) {
                    return req.error(400, `${day.day} hours cannot exceed 15.`);
                }
            }
        }

        const dailyValidations = [
            { 
                day: 'Monday', 
                hours: req.data.mondayHours !== undefined ? req.data.mondayHours : timesheet.mondayHours,
                details: req.data.mondayTaskDetails !== undefined ? req.data.mondayTaskDetails : timesheet.mondayTaskDetails
            },
            { 
                day: 'Tuesday', 
                hours: req.data.tuesdayHours !== undefined ? req.data.tuesdayHours : timesheet.tuesdayHours,
                details: req.data.tuesdayTaskDetails !== undefined ? req.data.tuesdayTaskDetails : timesheet.tuesdayTaskDetails
            },
            { 
                day: 'Wednesday', 
                hours: req.data.wednesdayHours !== undefined ? req.data.wednesdayHours : timesheet.wednesdayHours,
                details: req.data.wednesdayTaskDetails !== undefined ? req.data.wednesdayTaskDetails : timesheet.wednesdayTaskDetails
            },
            { 
                day: 'Thursday', 
                hours: req.data.thursdayHours !== undefined ? req.data.thursdayHours : timesheet.thursdayHours,
                details: req.data.thursdayTaskDetails !== undefined ? req.data.thursdayTaskDetails : timesheet.thursdayTaskDetails
            },
            { 
                day: 'Friday', 
                hours: req.data.fridayHours !== undefined ? req.data.fridayHours : timesheet.fridayHours,
                details: req.data.fridayTaskDetails !== undefined ? req.data.fridayTaskDetails : timesheet.fridayTaskDetails
            },
            { 
                day: 'Saturday', 
                hours: req.data.saturdayHours !== undefined ? req.data.saturdayHours : timesheet.saturdayHours,
                details: req.data.saturdayTaskDetails !== undefined ? req.data.saturdayTaskDetails : timesheet.saturdayTaskDetails
            },
            { 
                day: 'Sunday', 
                hours: req.data.sundayHours !== undefined ? req.data.sundayHours : timesheet.sundayHours,
                details: req.data.sundayTaskDetails !== undefined ? req.data.sundayTaskDetails : timesheet.sundayTaskDetails
            }
        ];

        for (const validation of dailyValidations) {
            if (validation.hours > 0 && (!validation.details || validation.details.trim() === '')) {
                return req.error(400, `${validation.day}: Task details are required when hours are entered.`);
            }
        }

        if (timesheet.status === 'Approved') {
            req.data.status = 'Modified';
        }
    });

// Enhanced DEBUG version - Replace your after UPDATE handler with this

this.after('UPDATE', 'MyTimesheets', async (data, req) => {
    console.log('=================================================');
    console.log('🔧 After UPDATE - Start notification check');
    console.log('🔧 Data ID:', data.ID);
    console.log('=================================================');
    
    const employee = await getAuthenticatedEmployee(req);
    if (!employee) {
        console.error('❌ ERROR: Employee not found, skipping notifications');
        return;
    }
    
    console.log('✅ Employee found:', {
        ID: employee.ID,
        employeeID: employee.employeeID,
        name: `${employee.firstName} ${employee.lastName}`,
        email: employee.email,
        managerID_ID: employee.managerID_ID
    });

    const timesheet = await SELECT.one.from('my.timesheet.Timesheets')
        .where({ ID: data.ID });

    if (!timesheet) {
        console.error('❌ ERROR: Timesheet not found after update');
        return;
    }
    
    console.log('✅ Timesheet found:', {
        ID: timesheet.ID,
        timesheetID: timesheet.timesheetID,
        status: timesheet.status,
        project_ID: timesheet.project_ID,
        nonProjectType_ID: timesheet.nonProjectType_ID,
        totalWeekHours: timesheet.totalWeekHours,
        task: timesheet.task
    });
    
    // CHECK 1: Environment Detection
    console.log('🌍 Environment Check:');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   VCAP_SERVICES exists:', !!process.env.VCAP_SERVICES);
    if (process.env.VCAP_SERVICES) {
        try {
            const vcap = JSON.parse(process.env.VCAP_SERVICES);
            console.log('   Destination service bound:', !!vcap.destination);
        } catch (e) {
            console.error('   ERROR parsing VCAP_SERVICES:', e.message);
        }
    }
  
    // CHECK 2: Timesheet Modification Detection
    console.log('📋 Checking Modification Trigger:');
    console.log('   Current status:', timesheet.status);
    console.log('   Is Modified?', timesheet.status === 'Modified');
    
    if (timesheet.status === 'Modified') {
        console.log('✅ TRIGGER DETECTED: Timesheet Modified');
        
        if (!employee.managerID_ID) {
            console.error('❌ SKIP: Employee has no manager assigned');
            return;
        }
        
        console.log('✅ Employee has manager ID:', employee.managerID_ID);
        
        // Create in-app notification
        const notificationCount = await SELECT.from('my.timesheet.Notifications');
        
        await INSERT.into('my.timesheet.Notifications').entries({
            notificationID: `NOT${String(notificationCount.length + 1).padStart(4, '0')}`,
            recipient_ID: employee.managerID_ID,
            message: `${employee.firstName} ${employee.lastName} modified previously approved timesheet for week ${timesheet.weekStartDate}`,
            notificationType: 'Timesheet Modified',
            isRead: false,
            relatedEntity: 'Timesheet',
            relatedEntityID: timesheet.ID
        });
        
        console.log('✅ In-app notification created');

        try {
            // Get manager details
            const manager = await SELECT.one
                .from('my.timesheet.Employees')
                .columns('email', 'firstName', 'lastName', 'ID', 'employeeID')
                .where({ ID: employee.managerID_ID });

            console.log('📧 Manager lookup result:', manager ? {
                ID: manager.ID,
                employeeID: manager.employeeID,
                name: `${manager.firstName} ${manager.lastName}`,
                email: manager.email
            } : 'NOT FOUND');

            if (!manager) {
                console.error('❌ SKIP: Manager record not found in database');
                return;
            }

            if (!manager.email) {
                console.error('❌ SKIP: Manager has no email address');
                return;
            }
            
            console.log('✅ Manager email found:', manager.email);
            console.log('📧 Preparing modification email...');
            
            // Get project details if exists
            let projectInfo = 'Non-Project Activity';
            if (timesheet.project_ID) {
                console.log('🔍 Looking up project:', timesheet.project_ID);
                const project = await SELECT.one
                    .from('my.timesheet.Projects')
                    .columns('projectName', 'projectID')
                    .where({ ID: timesheet.project_ID });
                
                if (project) {
                    projectInfo = `${project.projectName} (${project.projectID})`;
                    console.log('✅ Project found:', projectInfo);
                } else {
                    console.warn('⚠️ Project not found for ID:', timesheet.project_ID);
                }
            }

            console.log('📧 Calling notifyTimesheetModification with params:', {
                employeeName: `${employee.firstName} ${employee.lastName}`,
                employeeID: employee.employeeID,
                weekStartDate: timesheet.weekStartDate,
                weekEndDate: timesheet.weekEndDate,
                task: timesheet.task,
                projectInfo: projectInfo,
                totalHours: timesheet.totalWeekHours || 0,
                managerEmail: manager.email
            });

            const emailResult = await notifyTimesheetModification({
                employeeName: `${employee.firstName} ${employee.lastName}`,
                employeeID: employee.employeeID,
                weekStartDate: timesheet.weekStartDate,
                weekEndDate: timesheet.weekEndDate,
                task: timesheet.task,
                projectInfo: projectInfo,
                totalHours: timesheet.totalWeekHours || 0,
                managerEmail: manager.email
            });

            console.log('📧 Email function returned:', emailResult);

            if (emailResult && emailResult.success) {
                console.log('✅✅✅ MODIFICATION EMAIL SENT SUCCESSFULLY ✅✅✅');
                console.log('   Message ID:', emailResult.messageId);
                console.log('   Recipients:', emailResult.recipients);
                console.log('   Timestamp:', emailResult.timestamp);
            } else {
                console.error('❌❌❌ MODIFICATION EMAIL FAILED ❌❌❌');
                console.error('   Error:', emailResult?.error || 'Unknown error');
            }
        } catch (emailError) {
            console.error('❌❌❌ EXCEPTION in modification email:', emailError);
            console.error('   Message:', emailError.message);
            console.error('   Stack:', emailError.stack);
        }
    } else {
        console.log('ℹ️ Status is not Modified, checking non-project trigger...');
    }

    // CHECK 3: Non-Project Request Detection
    console.log('📋 Checking Non-Project Trigger:');
    console.log('   Has nonProjectType_ID?', !!timesheet.nonProjectType_ID);
    console.log('   Has project_ID?', !!timesheet.project_ID);
    console.log('   Is Non-Project?', !!timesheet.nonProjectType_ID && !timesheet.project_ID);
    
    if (timesheet.nonProjectType_ID && !timesheet.project_ID) {
        console.log('✅ TRIGGER DETECTED: Non-Project Request');
        
        try {
            // Get non-project type details
            console.log('🔍 Looking up non-project type:', timesheet.nonProjectType_ID);
            const nonProjectType = await SELECT.one
                .from('my.timesheet.NonProjectTypes')
                .columns('typeName', 'nonProjectTypeID', 'description')
                .where({ ID: timesheet.nonProjectType_ID });

            console.log('📋 Non-project type result:', nonProjectType || 'NOT FOUND');

            if (!nonProjectType) {
                console.error('❌ SKIP: Non-project type not found');
                return;
            }

            if (!employee.managerID_ID) {
                console.error('❌ SKIP: Employee has no manager assigned');
                return;
            }

            console.log('✅ Employee has manager ID:', employee.managerID_ID);

            // Get manager details
            const manager = await SELECT.one
                .from('my.timesheet.Employees')
                .columns('email', 'firstName', 'lastName', 'ID', 'employeeID')
                .where({ ID: employee.managerID_ID });

            console.log('📧 Manager lookup result:', manager ? {
                ID: manager.ID,
                employeeID: manager.employeeID,
                name: `${manager.firstName} ${manager.lastName}`,
                email: manager.email
            } : 'NOT FOUND');

            if (!manager) {
                console.error('❌ SKIP: Manager record not found in database');
                return;
            }

            if (!manager.email) {
                console.error('❌ SKIP: Manager has no email address');
                return;
            }
            
            console.log('✅ Manager email found:', manager.email);
            console.log('📧 Preparing non-project request email...');
            
            // Calculate total days (8 hours = 1 day)
            const totalDays = (timesheet.totalWeekHours / 8).toFixed(1);
            
            console.log('📧 Calling notifyNonProjectRequest with params:', {
                employeeName: `${employee.firstName} ${employee.lastName}`,
                employeeID: employee.employeeID,
                requestType: nonProjectType.typeName,
                requestTypeID: nonProjectType.nonProjectTypeID,
                weekStartDate: timesheet.weekStartDate,
                weekEndDate: timesheet.weekEndDate,
                totalHours: timesheet.totalWeekHours || 0,
                totalDays: totalDays,
                taskDetails: timesheet.taskDetails || 'No additional details provided',
                managerEmail: manager.email
            });

            const emailResult = await notifyNonProjectRequest({
                employeeName: `${employee.firstName} ${employee.lastName}`,
                employeeID: employee.employeeID,
                requestType: nonProjectType.typeName,
                requestTypeID: nonProjectType.nonProjectTypeID,
                weekStartDate: timesheet.weekStartDate,
                weekEndDate: timesheet.weekEndDate,
                totalHours: timesheet.totalWeekHours || 0,
                totalDays: totalDays,
                taskDetails: timesheet.taskDetails || 'No additional details provided',
                managerEmail: manager.email
            });

            console.log('📧 Email function returned:', emailResult);

            if (emailResult && emailResult.success) {
                console.log('✅✅✅ NON-PROJECT EMAIL SENT SUCCESSFULLY ✅✅✅');
                console.log('   Message ID:', emailResult.messageId);
                console.log('   Recipients:', emailResult.recipients);
                console.log('   Timestamp:', emailResult.timestamp);
            } else {
                console.error('❌❌❌ NON-PROJECT EMAIL FAILED ❌❌❌');
                console.error('   Error:', emailResult?.error || 'Unknown error');
            }
        } catch (emailError) {
            console.error('❌❌❌ EXCEPTION in non-project email:', emailError);
            console.error('   Message:', emailError.message);
            console.error('   Stack:', emailError.stack);
        }
    } else {
        console.log('ℹ️ Not a non-project request (either has project_ID or no nonProjectType_ID)');
    }

    console.log('=================================================');
    console.log('🔧 After UPDATE - Notification check complete');
    console.log('=================================================');
});

    // Function to get week boundaries
    this.on('getWeekBoundaries', async (req) => {
        const { date } = req.data;
        return getWeekBoundaries(date);
    });

    // Function to validate daily hours for a specific date
    this.on('validateDailyHours', async (req) => {
        const { date } = req.data;
        
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return 0;
        
        const employeeID = employee.ID;
        const weekBoundaries = getWeekBoundaries(date);

        const timesheets = await SELECT.from('my.timesheet.Timesheets')
            .where({ employee_ID: employeeID, weekStartDate: weekBoundaries.weekStart });
       
        const targetDate = new Date(date);
        const dayOfWeek = targetDate.getDay();
        
        let totalHours = 0;
        for (const ts of timesheets) {
            switch(dayOfWeek) {
                case 1: totalHours += parseFloat(ts.mondayHours || 0); break;
                case 2: totalHours += parseFloat(ts.tuesdayHours || 0); break;
                case 3: totalHours += parseFloat(ts.wednesdayHours || 0); break;
                case 4: totalHours += parseFloat(ts.thursdayHours || 0); break;
                case 5: totalHours += parseFloat(ts.fridayHours || 0); break;
                case 6: totalHours += parseFloat(ts.saturdayHours || 0); break;
                case 0: totalHours += parseFloat(ts.sundayHours || 0); break;
            }
        }

        return totalHours;
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
                message: `${employee.firstName} ${employee.lastName} submitted timesheet for week ${timesheet.weekStartDate}`,
                notificationType: 'Timesheet Submission',
                isRead: false,
                relatedEntity: 'Timesheet',
                relatedEntityID: timesheet.ID
            });
        }

        return 'Timesheet submitted successfully';
    });

    // Action: Update Timesheet with weekly data
    this.on('updateTimesheet', async (req) => {
        const { timesheetID, weekData } = req.data;
        
        const employee = await getAuthenticatedEmployee(req);
        if (!employee) return 'Employee not found';
        
        const employeeID = employee.ID;

        const timesheet = await SELECT.one.from('my.timesheet.Timesheets')
            .where({ timesheetID, employee_ID: employeeID });

        if (!timesheet) {
            return req.error(404, 'Timesheet not found');
        }

        let weeklyData;
        try {
            weeklyData = JSON.parse(weekData);
        } catch (e) {
            return req.error(400, 'Invalid weekly data format');
        }

        const updateData = {
            mondayHours: weeklyData.mondayHours || 0,
            tuesdayHours: weeklyData.tuesdayHours || 0,
            wednesdayHours: weeklyData.wednesdayHours || 0,
            thursdayHours: weeklyData.thursdayHours || 0,
            fridayHours: weeklyData.fridayHours || 0,
            saturdayHours: weeklyData.saturdayHours || 0,
            sundayHours: weeklyData.sundayHours || 0,
            
            mondayTaskDetails: weeklyData.mondayTaskDetails || '',
            tuesdayTaskDetails: weeklyData.tuesdayTaskDetails || '',
            wednesdayTaskDetails: weeklyData.wednesdayTaskDetails || '',
            thursdayTaskDetails: weeklyData.thursdayTaskDetails || '',
            fridayTaskDetails: weeklyData.fridayTaskDetails || '',
            saturdayTaskDetails: weeklyData.saturdayTaskDetails || '',
            sundayTaskDetails: weeklyData.sundayTaskDetails || ''
        };

        if (weeklyData.taskDetails) {
            updateData.taskDetails = weeklyData.taskDetails;
        }

        const dailyValidations = [
            { day: 'Monday', hours: updateData.mondayHours, details: updateData.mondayTaskDetails },
            { day: 'Tuesday', hours: updateData.tuesdayHours, details: updateData.tuesdayTaskDetails },
            { day: 'Wednesday', hours: updateData.wednesdayHours, details: updateData.wednesdayTaskDetails },
            { day: 'Thursday', hours: updateData.thursdayHours, details: updateData.thursdayTaskDetails },
            { day: 'Friday', hours: updateData.fridayHours, details: updateData.fridayTaskDetails },
            { day: 'Saturday', hours: updateData.saturdayHours, details: updateData.saturdayTaskDetails },
            { day: 'Sunday', hours: updateData.sundayHours, details: updateData.sundayTaskDetails }
        ];

        for (const validation of dailyValidations) {
            if (validation.hours > 0 && (!validation.details || validation.details.trim() === '')) {
                return req.error(400, `${validation.day}: Task details are required when hours are entered.`);
            }
        }
        
        updateData.totalWeekHours = 
            parseFloat(updateData.mondayHours) +
            parseFloat(updateData.tuesdayHours) +
            parseFloat(updateData.wednesdayHours) +
            parseFloat(updateData.thursdayHours) +
            parseFloat(updateData.fridayHours) +
            parseFloat(updateData.saturdayHours) +
            parseFloat(updateData.sundayHours);
        
        if (timesheet.status === 'Approved') {
            updateData.status = 'Modified';
        }

        await UPDATE('my.timesheet.Timesheets').set(updateData).where({ ID: timesheet.ID });

        return 'Timesheet updated successfully';
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
    // Helper entity for UI - Get assigned project IDs for dropdown
this.on('READ', 'AssignedProjectsList', async (req) => {
    const employee = await getAuthenticatedEmployee(req);
    if (!employee) return [];

    const timesheets = await SELECT.from('my.timesheet.Timesheets')
        .columns('project_ID')
        .where({ employee_ID: employee.ID });

    const projectIDs = [...new Set(timesheets.map(ts => ts.project_ID).filter(id => id))];
    
    if (projectIDs.length === 0) return [];

    const projects = await SELECT.from('my.timesheet.Projects')
        .columns('ID', 'projectID', 'projectName', 'projectRole', 'status')
        .where({ ID: { in: projectIDs }, status: 'Active' });

    return projects;
});
// ========================================
// DOCUMENT HANDLERS - Add to employee-service.js
// ========================================

this.on('READ', 'AvailableDocuments', async (req) => {
    const employee = await getAuthenticatedEmployee(req);
    if (!employee) return [];

    console.log('📄 AvailableDocuments READ for employee:', employee.employeeID);

    try {
        const documents = await SELECT.from('my.timesheet.Documents')
            .where({ isActive: true });

        console.log('Found', documents.length, 'active documents');

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
            
            // Remove content from list view
            delete doc.content;
        }

        return documents;

    } catch (error) {
        console.error('Error reading documents:', error);
        return [];
    }
});
this.on('downloadDocument', async (req) => {
  const employee = await getAuthenticatedEmployee(req);
  if (!employee) {
    return req.error(401, 'Employee not authenticated');
  }

  console.log('📥 Download Document - Employee:', employee.employeeID);
  const { documentID } = req.data;

  if (!documentID) {
    return req.error(400, 'Document ID is required');
  }

  try {
    console.log('🔍 Fetching document:', documentID);

    const db = await cds.connect.to('db');

    const documents = await db.run(
      SELECT.from('my.timesheet.Documents')
        .columns(
          'documentID',
          'documentName',
          'fileName',
          'mimeType',
          'fileSize',
          'content',
          'isActive'
        )
        .where({ documentID, isActive: true })
    );

    if (!documents || documents.length === 0) {
      console.log('❌ Document not found');
      return req.error(404, 'Document not found');
    }

    const document = documents[0];
    console.log('✅ Document found:', document.documentName);
    console.log('📊 Has content:', !!document.content);

    const c = document.content;
    console.log('📦 Raw content type:', typeof c, 'ctor:', c && c.constructor && c.constructor.name);

    if (!c) {
      console.error('❌ Document content is missing');
      return req.error(500, 'Document content is missing');
    }

    // 🔥 Normalize to Buffer, handling Buffer, string, Uint8Array and Readable stream
    let buffer;

    if (Buffer.isBuffer(c)) {
      console.log('✅ Content is Buffer');
      buffer = c;

    } else if (typeof c === 'string') {
      console.log('✅ Content is base64 string, decoding...');
      buffer = Buffer.from(c, 'base64');

    } else if (c instanceof Uint8Array) {
      console.log('✅ Content is Uint8Array, wrapping as Buffer...');
      buffer = Buffer.from(c);

    } else if (c instanceof Readable || (c && typeof c.read === 'function' && typeof c.pipe === 'function')) {
      console.log('✅ Content is Readable stream, collecting into Buffer...');
      buffer = await streamToBuffer(c);

    } else if (typeof c === 'object') {
      // Last-chance generic object handling
      if (c.data && (Buffer.isBuffer(c.data) || c.data instanceof Uint8Array || Array.isArray(c.data))) {
        console.log('✅ Content has .data, converting...');
        buffer = Buffer.from(c.data);
      } else if (c.buffer && c.byteLength !== undefined) {
        console.log('✅ Content has .buffer/.byteLength, converting...');
        buffer = Buffer.from(c.buffer);
      } else {
        console.error('❌ Unsupported content object shape, keys:', Object.keys(c || {}));
        return req.error(500, 'Invalid document content format (object not convertible).');
      }

    } else {
      console.error('❌ Unsupported content type:', typeof c);
      return req.error(500, 'Invalid document content format (unsupported type).');
    }

    if (!buffer || !Buffer.isBuffer(buffer)) {
      console.error('❌ Failed to normalize content to Buffer');
      return req.error(500, 'Failed to normalize document content.');
    }

    console.log('💾 Final buffer size:', (buffer.length / 1024).toFixed(2), 'KB');

    // 👉 Return JSON with base64 so UI can handle download
    const base64Content = buffer.toString('base64');
    console.log('✅ Returning base64 content, length:', base64Content.length);

    return {
      fileName: document.fileName || document.documentName || 'document.pdf',
      mimeType: document.mimeType || 'application/pdf',
      content: base64Content
    };

  } catch (error) {
    console.error('❌ Error downloading document:', error);
    console.error('Stack:', error.stack);
    return req.error(500, 'Failed to download document: ' + error.message);
  }
});

});