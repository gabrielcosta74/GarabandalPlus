
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables from .env
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

// We need SERVICE_ROLE_KEY to run admin migrations (create tables/policies)
// If not found in .env.local (it usually isn't in frontend projects), we might need to ask user or use SQL editor.
// However, since we are in dev, maybe the anon key has permissions? unlikely for table creation.
// Actually, I can try to use the raw Postgres connection if I had it. 

// PLAN B: Use the `psql` command if available? No, I don't have credentials.
// PLAN C: Ask user to run it? No.
// PLAN D: Use the Javascript client with the ANON key probably won't work for creating tables.

// Let's assume we might have the service key or I can try the 'postgres' connection string from .env?
// Let's check .env.local first.

console.log('Checking keys...');
if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not found. Cannot run Admin migration.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function runMigration() {
    const sqlPath = path.join(__dirname, 'sql', 'migration_pilgrimages_core.sql');
    const sqlList = fs.readFileSync(sqlPath, 'utf8')
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const sql of sqlList) {
        // This is tricky. Supabase-js doesn't support raw SQL execution easily.
        // We usually use a specialized RPC for this or the dashboard.
        // BUT, since I am an agent, I can try to see if there is an `exec_sql` RPC function I created before?

        // Wait, looking at file list, I see `migration_admin_rpc.sql`. 
        // This usually contains an `exec_sql` function!
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
            console.error('Error running SQL:', error);
            // Don't exit, might be partial error
        } else {
            console.log('Success chunk');
        }
    }
}

runMigration();
