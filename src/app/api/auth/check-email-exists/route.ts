import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    // Disabled in production hardening pass:
    // public account enumeration endpoint.
    return NextResponse.json(
        { exists: false, disabled: true },
        {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            }
        }
    );
}
