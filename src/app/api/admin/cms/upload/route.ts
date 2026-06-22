import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdminToken } from '../../../../../lib/cms/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

/**
 * POST /api/admin/cms/upload
 * Headers: Authorization: Bearer <session.access_token>
 * Body: multipart/form-data with field "file"
 * Response: { url, hash, mime, size }
 *
 * Server-side admin check + mime/size validation. The file is hashed and
 * uploaded to bucket 'posts-media' under <hash>.<ext> (idempotent).
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  const admin = await verifyAdminToken(token);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  let file: File | null = null;
  try {
    const fd = await req.formData();
    file = fd.get('file') as File | null;
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({ error: `Unsupported mime type: ${file.type}` }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = EXT_BY_MIME[file.type] ?? '.bin';
  const filename = `${hash.slice(0, 16)}${ext}`;

  const { error: upErr } = await supabaseServer.storage
    .from('posts-media')
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '31536000',
    });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publicUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/posts-media/${filename}`;

  // Best-effort: register in media table (idempotent on hash).
  await supabaseServer.from('media').upsert({
    storage_bucket: 'posts-media',
    storage_path: filename,
    public_url: publicUrl,
    filename,
    mime_type: file.type,
    size_bytes: buffer.length,
    hash,
  }, { onConflict: 'hash' });

  return NextResponse.json({ url: publicUrl, hash, mime: file.type, size: buffer.length });
}
