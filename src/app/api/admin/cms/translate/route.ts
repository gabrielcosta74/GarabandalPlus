import { NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../../../lib/cms/authz';
import { translateText, type TranslateKind } from '../../../../../lib/cms/translate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/cms/translate
 * Headers: Authorization: Bearer <admin>
 * Body: { source: string (HTML), targetLocale: 'pt'|'en'|'es'|'fr'|'it', sourceLocale, kind: 'body'|'title'|'short' }
 *
 * Thin wrapper over lib/cms/translate.translateText (also used by the batch
 * translateGroup server action). Output for kind='body' is sanitized HTML.
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  const admin = await verifyAdminToken(token);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  type Body = { source?: string; sourceLocale?: string; targetLocale?: string; kind?: TranslateKind };
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = await translateText({
    source: body.source ?? '',
    sourceLocale: body.sourceLocale ?? 'pt',
    targetLocale: body.targetLocale ?? 'en',
    kind: body.kind ?? 'body',
  });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ translated: result.translated });
}
