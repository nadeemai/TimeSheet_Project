const cds = require('@sap/cds');
const fs = require('fs');
const path = require('path');

async function uploadUserManual() {
  try {
    console.log('📤 Starting User Manual PDF Upload...');
    console.log('='.repeat(50));

    // 1️⃣ Load CDS model
    const model = await cds.load('*');
    cds.model = model;

    // 2️⃣ Connect to DB
    const db = await cds.connect.to('db');
    console.log('✅ Connected to database');

    // 3️⃣ Entity names
    const Documents = 'my.timesheet.Documents';
    const Employees = 'my.timesheet.Employees';

    // 4️⃣ Path to PDF file
    const pdfPath = path.join(__dirname, '..', 'assets', 'user-manual.pdf');
    console.log('📁 Looking for PDF at:', pdfPath);

    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF file not found!');
      console.log('📋 Instructions:');
      console.log('  1. Create "assets" folder in project root');
      console.log('  2. Place "user-manual.pdf" inside assets folder');
      console.log('  3. Run this script again');
      return;
    }

    // 5️⃣ Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    const fileSize = pdfBuffer.length;
    console.log('✅ PDF loaded - Size:', (fileSize / 1024).toFixed(2), 'KB');

    // 6️⃣ Convert to Base64 (HANA LargeBinary storage)
    const base64Content = pdfBuffer.toString('base64');
    console.log('✅ Converted to Base64 - Length:', base64Content.length);

    // 7️⃣ Get uploader (any active employee)
    const employee = await db.run(
      SELECT.one
        .from(Employees)
        .where({ isActive: true })
        .orderBy('createdAt')
    );

    if (!employee) {
      console.error('❌ No active employee found in database');
      return;
    }
    console.log('✅ Using uploader:', employee.employeeID, '-', employee.firstName, employee.lastName);

    // 8️⃣ Check if document already exists
    const existing = await db.run(
      SELECT.one
        .from(Documents)
        .where({ fileName: 'user-manual.pdf' })
    );

    if (existing) {
      console.log('⚠️  Document exists, updating...');
      console.log('📄 Existing Document ID:', existing.documentID);
      
      await db.run(
        UPDATE(Documents)
          .set({ 
            content: base64Content, 
            fileSize: fileSize,
            modifiedAt: new Date().toISOString()
          })
          .where({ ID: existing.ID })
      );
      
      console.log('✅ Document content updated');
      
      // Verify update
      const verified = await db.run(
        SELECT.one
          .from(Documents)
          .columns('documentID', 'fileName', 'fileSize', 'content')
          .where({ ID: existing.ID })
      );
      
      console.log('🔍 Verification:', {
        documentID: verified.documentID,
        fileName: verified.fileName,
        storedSize: verified.fileSize,
        hasContent: !!verified.content,
        contentLength: verified.content ? verified.content.length : 0
      });
      
      return;
    }

    // 9️⃣ Insert new document
    console.log('📝 Creating new document...');
    const allDocs = await db.run(SELECT.from(Documents));
    const documentID = `DOC${String(allDocs.length + 1).padStart(4, '0')}`;
    console.log('🆔 Generated Document ID:', documentID);

    await db.run(
      INSERT.into(Documents).entries({
        documentID: documentID,
        documentName: 'Application User Manual',
        documentType: 'User Manual',
        description: 'Complete guide for Timesheet Application - Employee, Manager, and Admin workflows',
        fileName: 'user-manual.pdf',
        mimeType: 'application/pdf',
        fileSize: fileSize,
        content: base64Content,
        category: 'Manual',
        version: '1.0',
        isActive: true,
        uploadedBy_ID: employee.ID,
        accessLevel: 'All',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      })
    );

    console.log('✅ Document inserted');

    // 🔟 Verify insertion
    const inserted = await db.run(
      SELECT.one
        .from(Documents)
        .columns('documentID', 'documentName', 'fileName', 'fileSize', 'content', 'isActive')
        .where({ documentID: documentID })
    );

    if (!inserted) {
      console.error('❌ Verification failed - document not found after insert');
      return;
    }

    console.log('='.repeat(50));
    console.log('✅✅✅ SUCCESS! ✅✅✅');
    console.log('='.repeat(50));
    console.log('📄 Document ID:', inserted.documentID);
    console.log('📋 Name:', inserted.documentName);
    console.log('📁 File:', inserted.fileName);
    console.log('💾 Size:', (inserted.fileSize / 1024).toFixed(2), 'KB');
    console.log('✅ Active:', inserted.isActive);
    console.log('📦 Content stored:', !!inserted.content);
    console.log('📏 Content length:', inserted.content ? inserted.content.length : 0);
    console.log('🎉 Available for all users!');
    console.log('='.repeat(50));
    console.log('');
    console.log('🧪 Test download with:');
    console.log('GET http://localhost:4007/odata/v4/employee/downloadDocument');
    console.log('Body: { "documentID": "' + inserted.documentID + '" }');
    
  } catch (error) {
    console.error('='.repeat(50));
    console.error('❌ ERROR:', error.message);
    console.error('='.repeat(50));
    console.error('Stack trace:', error.stack);
  }
}

// Run the upload
uploadUserManual()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  });