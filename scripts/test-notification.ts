
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testFlow() {
    console.log('--- Starting Admin Notification Test Flow ---');

    // 1. Insert
    console.log('1. Creating notification...');
    const { data: inserted, error: insertErr } = await supabase.from('admin_notifications').insert({
        type: 'order',
        title: 'Teste Automático',
        message: 'Verificação de fluxo completo.',
        link: '/admin/teste',
        created_at: new Date().toISOString()
    }).select().single();

    if (insertErr || !inserted) {
        console.error('❌ Insert failed:', insertErr);
        return;
    }
    console.log('✅ Inserted ID:', inserted.id);

    // 2. Fetch Unread Count
    console.log('2. checking unread count...');
    const { count: countBefore, error: countErr } = await supabase
        .from('admin_notifications')
        .select('*', { count: 'exact', head: true })
        .is('read_at', null);

    if (countErr) console.error('❌ Count failed:', countErr);
    else console.log('✅ Current Unread Count:', countBefore);

    // 3. Mark as Read
    console.log('3. Marking as read...');
    const { error: updateErr } = await supabase
        .from('admin_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', inserted.id);

    if (updateErr) {
        console.error('❌ Update failed:', updateErr);
        return;
    }
    console.log('✅ Marked as read.');

    // 4. Verify Read
    const { data: check, error: checkErr } = await supabase
        .from('admin_notifications')
        .select('read_at')
        .eq('id', inserted.id)
        .single();

    if (checkErr) console.error('❌ Verification failed:', checkErr);
    else if (check.read_at) console.log('✅ Verified: Notification has read_at date:', check.read_at);
    else console.error('❌ Failed: Notification still unread.');

    console.log('--- Test Flow Complete ---');
}

testFlow();
