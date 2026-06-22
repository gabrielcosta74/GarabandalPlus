import { NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../../../lib/cms/authz';
import { PREVIEW_COOKIE_NAME } from '../../../../../lib/content/preview';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Toggle the cms-preview cookie. Requires admin Bearer token.
 *
 *   POST /api/admin/cms/preview      → enable
 *   DELETE /api/admin/cms/preview    → disable
 *
 * Cookie attributes: HttpOnly, Secure (in prod), SameSite=Lax, 8h max-age.
 * The cookie alone does not unlock drafts — `getPublicStatuses` still requires
 * a valid admin Supabase session in addition.
 */
async function authorise(req: Request) {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  return verifyAdminToken(token);
}

const cookieAttrs = (enable: boolean) => {
  const base = `${PREVIEW_COOKIE_NAME}=${enable ? '1' : ''}; Path=/; SameSite=Lax; HttpOnly`;
  const expiry = enable ? 'Max-Age=28800' : 'Max-Age=0';
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${base}; ${expiry}${secure}`;
};

export async function POST(req: Request) {
  const admin = await authorise(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const res = NextResponse.json({ ok: true, preview: true });
  res.headers.append('Set-Cookie', cookieAttrs(true));
  return res;
}

export async function DELETE(req: Request) {
  const admin = await authorise(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const res = NextResponse.json({ ok: true, preview: false });
  res.headers.append('Set-Cookie', cookieAttrs(false));
  return res;
}
