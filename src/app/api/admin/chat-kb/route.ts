import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/admin-auth';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const KB_DIR = path.join(process.cwd(), 'src', 'lib', 'chat-kb');

// GET — list all KB files with content
export async function GET(req: Request) {
    const auth = await verifyAdmin(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    try {
        const files = fs.readdirSync(KB_DIR)
            .filter(f => f.endsWith('.md'))
            .sort()
            .map(filename => ({
                filename,
                content: fs.readFileSync(path.join(KB_DIR, filename), 'utf8'),
            }));
        return NextResponse.json({ files });
    } catch (e) {
        console.error('[chat-kb admin] GET error:', e);
        return NextResponse.json({ error: 'Erro ao ler ficheiros KB' }, { status: 500 });
    }
}

// POST — save a KB file
export async function POST(req: Request) {
    const auth = await verifyAdmin(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    try {
        const { filename, content } = await req.json();

        if (!filename || typeof filename !== 'string' || !filename.endsWith('.md')) {
            return NextResponse.json({ error: 'Nome de ficheiro inválido' }, { status: 400 });
        }
        // Prevent path traversal
        const safe = path.basename(filename);
        if (safe !== filename) {
            return NextResponse.json({ error: 'Nome de ficheiro inválido' }, { status: 400 });
        }
        if (typeof content !== 'string') {
            return NextResponse.json({ error: 'Conteúdo inválido' }, { status: 400 });
        }

        fs.writeFileSync(path.join(KB_DIR, safe), content, 'utf8');

        // Invalidate the in-memory cache so next request reloads
        const kbModule = await import('../../../../lib/chat-kb');
        // @ts-ignore — reset cache
        kbModule._resetCache?.();

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[chat-kb admin] POST error:', e);
        return NextResponse.json({ error: 'Erro ao guardar ficheiro' }, { status: 500 });
    }
}

// GET conversations for analytics — separate endpoint pattern kept in same route via query param
// GET /api/admin/chat-kb?conversations=1
