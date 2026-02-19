import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isActiveMember } from '../../../../lib/store-discounts';
import { checkRateLimit } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'members-check-status',
            windowMs: 60_000,
            max: 20
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { results: {} },
                {
                    status: 429,
                    headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) }
                }
            );
        }

        const body = await request.json();
        const { emails } = body;

        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return NextResponse.json({ results: {} });
        }

        // SECURITY: Limit batch size to prevent scraping
        if (emails.length > 10) {
            return NextResponse.json({ error: 'Too many emails' }, { status: 400 });
        }

        // SECURITY: Rate Limit / Origin Check (Basic)
        // Ensure request comes from our own frontend
        const referer = request.headers.get('referer');
        const origin = request.headers.get('origin');
        const host = request.headers.get('host');

        // Skip check in dev if needed, or check against localhost
        const isDev = process.env.NODE_ENV === 'development';
        const validOrigin = referer?.includes(host || '') || origin?.includes(host || '');

        if (!isDev && !validOrigin) {
            // Fallback: Check for Auth
            const authHeader = request.headers.get('Authorization');
            if (!authHeader) {
                console.warn(`[API] Blocked external request to check-status from: ${referer || 'unknown'}`);
                return NextResponse.json({ results: {} }); // Silent fail
            }
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        // CRITICAL: Must use Service Role Key to bypass RLS policies on 'membros' table
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseKey) {
            console.error('[API] 🚨 ERROR: SUPABASE_SERVICE_ROLE_KEY is missing/undefined. Cannot verify members.');
            return NextResponse.json({ results: {} });
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });

        // Normalize emails
        const cleanEmails = emails
            .filter(e => e && typeof e === 'string' && e.includes('@'))
            .map(e => e.toLowerCase().trim());

        if (cleanEmails.length === 0) {
            return NextResponse.json({ results: {} });
        }

        // Query Members Table
        // We assume 'membros' table has 'email' and membership columns.
        const { data: members, error } = await supabase
            .from('membros')
            .select('email, is_membro, estado_quota, tipo_subscricao, proxima_quota')
            .in('email', cleanEmails);

        if (error) {
            console.error('[API] Check Member Status Error:', error);
            // Fail safe: return all false rather than crashing
            return NextResponse.json({ results: {} });
        }

        // Build Result Map
        const results: Record<string, boolean> = {};
        cleanEmails.forEach(e => {
            results[e] = false; // Default to false
        });

        members?.forEach((m: any) => {
            if (m.email && isActiveMember(m)) {
                results[m.email.toLowerCase()] = true;
            }
        });

        return NextResponse.json({ results });

    } catch (err: any) {
        console.error('[API] Unexpected Error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
