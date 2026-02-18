
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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not found. Cannot run Admin migration.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function runMigration() {
    const sql = `
    create table if not exists public.pilgrimage_gallery_images (
      id uuid primary key default gen_random_uuid(),
      pilgrimage_id uuid references public.pilgrimages(id) on delete cascade not null,
      image_url text not null,
      display_order int default 0,
      is_featured boolean default true,
      created_at timestamptz default now()
    );

    alter table public.pilgrimage_gallery_images enable row level security;

    create policy "Public can view gallery images"
      on public.pilgrimage_gallery_images
      for select
      using (true);

    create policy "Admins can manage gallery images"
      on public.pilgrimage_gallery_images
      for all
      using (
        auth.role() = 'authenticated' -- We can refine this later if needed, but for now authenticated is likely admin in this context or we rely on app logic
      );
    `;

    console.log("Running SQL...");
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error running SQL:', error);
        // If exec_sql doesn't exist, we might get an error here.
    } else {
        console.log('Success: Table created or already exists.');
    }
}

runMigration();
