import { NextResponse } from 'next/server';
import { ReduniqClient } from '../../../lib/reduniq/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    const expectedSecret = process.env.TEST_REDUNIQ_SECRET || '';
    if (expectedSecret) {
        const providedSecret = request.headers.get('x-test-secret') || '';
        if (providedSecret !== expectedSecret) {
            return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
        }
    }

    const envStatus = {
        hasUser: !!process.env.REDUNIQ_API_USER,
        hasPass: !!process.env.REDUNIQ_API_PASSWORD,
        hasEndpoint: !!process.env.REDUNIQ_API_ENDPOINT,
    };

    // Log to server console
    console.log('[TestReduniq] Env Status:', envStatus);

    if (!envStatus.hasUser || !envStatus.hasEndpoint) {
        return NextResponse.json({
            success: false,
            message: 'Environment variables not loaded. Server restart required.',
            debug: envStatus
        }, { status: 200 });
    }

    try {
        const client = new ReduniqClient();
        const result = await client.testConnection();
        return NextResponse.json({ ...result, debug: envStatus });
    } catch (err: any) {
        console.error('[TestReduniq] Error:', err);
        return NextResponse.json({
            success: false,
            message: 'Unhandled error in route execution',
            error: err?.message || 'Unknown error'
        }, { status: 500 });
    }
}
