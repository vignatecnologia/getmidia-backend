const pool = require('./config/db');
const fs = require('fs');
const path = require('path');

async function initDb() {
    try {
        const schemaPath = 'C:\\Users\\julio\\.gemini\\antigravity\\brain\\e0f440ea-65c7-48d0-b285-829a03ba957b\\mysql_schema.sql';
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Split SQL statements by ';' but handle cases where ';' is inside strings if needed
        // This simple split works for our current schema
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        console.log(`🚀 Executing ${statements.length} SQL statements on Hostinger MySQL...`);

        for (const statement of statements) {
            await pool.query(statement);
        }

        console.log('✅ Database schema initialized successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error initializing database:', err.message);
        process.exit(1);
    }
}

initDb();
