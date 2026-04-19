import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { translateBatch, translateText } from '../../../../lib/deepl';
import { verifyAdmin } from '../../../../lib/admin-auth';

const ADMIN_EMAILS = [
  process.env.ADMIN_EMAIL,
  ...(process.env.ADMIN_EMAILS || '').split(','),
  ...(process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(','),
]
  .filter(Boolean)
  .map((email) => email?.trim().toLowerCase());

async function getCookieAdminUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

async function isAuthorizedAdmin(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');

  if (authHeader) {
    const { authorized } = await verifyAdmin(req);
    if (authorized) return true;
  }

  const user = await getCookieAdminUser();
  return !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

/**
 * POST /api/admin/translate
 * Body: { text: string } ou { texts: string[] }
 * Retorna: { translated: string } ou { translated: string[] }
 */
export async function POST(req: NextRequest) {
  const authorized = await isAuthorizedAdmin(req);
  if (!authorized) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!process.env.DEEPL_API_KEY) {
    return NextResponse.json(
      { error: 'DEEPL_API_KEY não configurada. Adiciona ao .env.local.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    if (Array.isArray(body.texts)) {
      const translated = await translateBatch(body.texts);
      return NextResponse.json({ translated });
    }

    if (typeof body.text === 'string') {
      const translated = await translateText(body.text);
      return NextResponse.json({ translated });
    }

    return NextResponse.json(
      { error: 'Parâmetro inválido: envia text (string) ou texts (array)' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[translate]', err);
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 });
  }
}
