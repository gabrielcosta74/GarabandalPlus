import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseBrowser = createClient(supabaseUrl, anonKey);

async function run() {
  const email = 'test' + Date.now() + '@example.com';
  console.log("Trying to sign up: " + email);

  const { data, error } = await supabaseBrowser.auth.signUp({
    email,
    password: 'password1234'
  });

  console.log("Error:", error?.message);
  console.log("Session exists?", !!data.session);
  console.log("User ID:", data.user?.id);

  if (data.user) {
    if (data.session) {
      console.log("Session token:", data.session.access_token.substring(0, 10) + "...");
      // test RLS profile save
      const payload = {
        id: data.user.id,
        nome: 'Test From Mock',
        email: email,
        telefone: '+351912345678',
        address: 'Test Street 1',
        postal_code: '4000-000',
        country: 'PT',
        nif: '123456789',
        updated_at: new Date().toISOString(),
        is_membro: false,
        tipo_subscricao: 'regulares',
        data_adesao: new Date().toISOString(),
        estado_quota: 'pendente',
        referred_by_code: 'APO-TESTE' // Likely invalid FK
      };
      console.log("Trying to insert profile...");
      const { data: profileData, error: profileErr } = await supabaseBrowser.from('membros').upsert(payload, { onConflict: 'id' }).select();
      console.log("Profile Error:", profileErr?.message || profileErr?.code || "None");
    } else {
      console.log("No session exists. If UI proceeded, it did so without a session. Supabase returned user but no session.");
      // Let's test the profile save WITHOUT a session (what the UI did before my fix)
      const payload = {
        id: data.user.id,
        nome: 'Test From Mock',
        email: email,
        telefone: '+351912345678',
        address: 'Test Street 1',
        postal_code: '4000-000',
        country: 'PT',
        nif: '123456789',
        updated_at: new Date().toISOString(),
        is_membro: false,
        tipo_subscricao: 'regulares',
        data_adesao: new Date().toISOString(),
        estado_quota: 'pendente',
        referred_by_code: 'APO-TESTE'
      };
      const { data: profileData, error: profileErr } = await supabaseBrowser.from('membros').upsert(payload, { onConflict: 'id' }).select();
      console.log("Profile Insert Without Session Error:", profileErr?.message || profileErr?.code || "None");
    }
  }
}

run();
