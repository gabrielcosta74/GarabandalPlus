import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { error } = await supabase.rpc('exec_sql', {
        sql_string: 'ALTER TABLE auction_items ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;'
    });

    if (error) {
        console.log("RPC Failed, trying REST API for migration...", error.message);
        const { data, error: tableError } = await supabase.from('auction_items').select('id').limit(1);
        if (!tableError) console.log("Table exists but we cannot alter it without raw SQL access from the client.");
    } else {
        console.log("Migration executed successfully via RPC.");
    }
}
run();
