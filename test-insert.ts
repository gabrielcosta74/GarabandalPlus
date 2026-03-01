import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const payload = {
    id: 'f3914a1a-37e4-4c48-8df0-7817eb68b355', // fake valid uuid
    nome: 'Test Name',
    email: 'test' + Date.now() + '@example.com',
    telefone: '+351912345678',
    address: 'Test Street 1',
    postal_code: '4000-000',
    country: 'PT',
    nif: null,
    updated_at: new Date().toISOString(),
    is_membro: false,
    tipo_subscricao: 'regulares',
    data_adesao: new Date().toISOString(),
    estado_quota: 'pendente',
    referred_by_code: 'APO-TESTE' // Likely invalid FK
  };

  const { data, error } = await supabase.from('membros').upsert(payload, { onConflict: 'id' }).select();
  console.log("DB Error:", JSON.stringify(error, null, 2));
  console.log("Data:", data);
  if (!error) {
    await supabase.from('membros').delete().eq('id', payload.id);
  }
}

run();
