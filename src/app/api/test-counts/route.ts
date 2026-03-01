import { NextResponse } from 'next/server';
import { getAdminCounts } from '../../../lib/admin-notifications';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log('Test counts hitting database...');
        const counts = await getAdminCounts();
        console.log('Counts:', counts);
        return NextResponse.json(counts);
    } catch (e: any) {
        console.error('Error in test route:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
