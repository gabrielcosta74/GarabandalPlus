import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

// Helper to validate Admin Session
const isAdmin = async (req: Request) => {
    if (!supabaseServer) return false;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);
    return !error && !!user;
};

export async function GET(req: Request) {
    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        const { searchParams } = new URL(req.url);
        // Filters can be processed client-side for small datasets, 
        // but we fetch everything to calculate the summary accurately.

        const { data: members, error } = await supabaseServer
            .from('membros')
            .select('*')
            .order('numero_socio', { ascending: true });

        if (error) throw error;

        // Calculate Summary
        const allMembers = members || [];
        const total = allMembers.length;

        const active = allMembers.filter(m => (m.estado_quota || '').toLowerCase() === 'pago' || (m.estado_quota || '').toLowerCase() === 'paid').length;
        const overdue = allMembers.filter(m => (m.estado_quota || '').toLowerCase().includes('atras')).length;
        const pending = allMembers.filter(m => (m.estado_quota || '').toLowerCase() === 'pendente').length;

        // Founders assumption: check type_subscription or low numbers? 
        // Using 'tipo_subscricao' if available, otherwise 0
        const founders = allMembers.filter(m => (m.tipo_subscricao || '').toLowerCase().includes('fundador')).length;

        // Due Soon (Arbitrary logic or based on dates if available)
        // For now, let's keep it 0 or simple logic
        const dueSoon = 0;

        return NextResponse.json({
            members: allMembers,
            summary: {
                total,
                active,
                pending,
                overdue,
                founders,
                dueSoon
            }
        });

    } catch (error) {
        console.error("Admin Members API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
