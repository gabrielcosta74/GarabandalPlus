/**
 * Script to create a test auction item with a very low price.
 * 
 * Usage: npx tsx scripts/create-test-auction.ts
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    // Auction ends in 5 minutes for quick testing
    const endsAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('auction_items')
        .insert({
            title: '🧪 Terço de Teste — Leilão Rápido',
            description: 'Item de teste para validar o fluxo completo de leilão: licitação, fecho automático, emails e pagamento. Pode ser apagado após o teste.',
            images: [],
            artisan_name: 'Teste Artesã',
            starting_price: 100,     // 1€ in cents
            min_increment: 50,       // 0.50€ increment
            ends_at: endsAt,
            status: 'active',        // Already active, no need to activate via admin
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Error creating test auction:', error.message);
        process.exit(1);
    }

    console.log('✅ Test auction created successfully!');
    console.log('');
    console.log(`   ID:             ${data.id}`);
    console.log(`   Title:          ${data.title}`);
    console.log(`   Starting price: ${(data.starting_price / 100).toFixed(2)}€`);
    console.log(`   Min increment:  ${(data.min_increment / 100).toFixed(2)}€`);
    console.log(`   Ends at:        ${new Date(data.ends_at).toLocaleString('pt-PT')}`);
    console.log(`   Status:         ${data.status}`);
    console.log('');
    console.log(`   🔗 URL: http://localhost:3001/leilao/${data.id}`);
    console.log('');
    console.log('   ⏰ O leilão termina em 5 minutos.');
    console.log('   📧 Após terminar, corre o cron: GET /api/cron/auction-close');
}

main();
