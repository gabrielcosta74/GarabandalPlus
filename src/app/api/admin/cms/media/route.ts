import { NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../../../lib/cms/authz';
import { supabaseServer } from '../../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Lightweight media list endpoint for the in-editor MediaPicker.
 * Auth: Bearer admin token. Filter, search and cursor pagination.
 *
 * Query params:
 *   q?      free-text on filename or alt
 *   filter? 'all' | 'no-alt' | 'with-alt'
 *   cursor? ISO timestamp from `created_at` of the last item received
 *   limit?  1-100 (default 30)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  const admin = await verifyAdminToken(token);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabaseServer) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  const q = url.searchParams.get('q')?.trim();
  const filter = url.searchParams.get('filter') ?? 'all';
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '30'), 1), 100);

  let query = supabaseServer
    .from('media')
    .select('id, filename, public_url, alt, width, height, mime_type, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter === 'no-alt') query = query.or('alt.is.null,alt.eq.');
  if (filter === 'with-alt') query = query.not('alt', 'is', null).neq('alt', '');
  if (q) query = query.or(`filename.ilike.%${q}%,alt.ilike.%${q}%`);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = data ?? [];
  const nextCursor = items.length === limit ? items[items.length - 1].created_at : null;
  return NextResponse.json({ items, nextCursor });
}
