import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('get_policies');
  if (error) {
     // fallback to raw query
     const query = `
       SELECT table_name, policy_name, roles, cmd, qual, with_check
       FROM pg_policies
       WHERE table_name = 'membros';
     `;
     // Supabase js can't run raw query easily without a function, let's just do a fetch to the REST API? No, raw queries need psql.
     console.log("Cannot easily fetch policies without psql / rpc");
  } else {
     console.log("Policies:", data);
  }
}
run();
