import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

const types = ['request', 'post', 'comment', 'person', 'gathering', 'mass_comment'] as const;
const actions = ['hide', 'restore', 'dismiss', 'escalate', 'remove_avatar'] as const;
type QueueRow = {
  content_type: string; content_id: string; author_id: string; body: string;
  report_count: number; last_reported_at: string; is_hidden: boolean;
  reasons: string[]; image_path?: string | null;
};

async function authorized(req: Request) {
  if (!supabaseServer) return { error: NextResponse.json({ error: 'Database Config Error' }, { status: 500 }) };
  const result = await verifyAdmin(req);
  if (!result.authorized) return {
    error: NextResponse.json({ error: result.error || 'Unauthorized' }, {
      status: result.error === 'Forbidden: Not an Admin' ? 403 : 401,
    }),
  };
  return { user: result.user };
}

export async function GET(req: Request) {
  const access = await authorized(req);
  if (access.error) return access.error;
  try {
    const includeHistory = new URL(req.url).searchParams.get('history') === '1';
    const fields: string = includeHistory
      ? 'content_type,content_id,author_id,body,report_count,last_reported_at,is_hidden,reasons'
      : 'content_type,content_id,author_id,body,report_count,last_reported_at,is_hidden,reasons,image_path';
    // Os pedidos de oração têm a sua própria fila, logo acima nesta página.
    const { data, error } = await supabaseServer!
      .from(includeHistory ? 'community_moderation_queue_v3' : 'community_moderation_pending_v1')
      .select(fields)
      .neq('content_type', 'request')
      .order('last_reported_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const rows = (data || []) as unknown as QueueRow[];
    const authorIds = Array.from(new Set(rows.map((item) => item.author_id)));
    const [{ data: members, error: memberError }, { data: profiles, error: profileError }] = authorIds.length
      ? await Promise.all([
        supabaseServer!.from('membros').select('id,nome,email,avatar_url').in('id', authorIds),
        supabaseServer!.from('community_profiles').select('user_id,avatar_url').in('user_id', authorIds),
      ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (memberError) throw memberError;
    if (profileError) throw profileError;
    const byId = new Map((members || []).map((member) => [member.id, member]));
    // Contas sem associação (a maioria) guardam a foto no perfil da comunidade e o nome na conta.
    const profileAvatar = new Map((profiles || []).map((profile) => [profile.user_id, profile.avatar_url as string | null]));
    const accounts = new Map(await Promise.all(authorIds.filter((id) => !byId.has(id)).map(async (id) => {
      const { data: account } = await supabaseServer!.auth.admin.getUserById(id);
      const meta = account?.user?.user_metadata || {};
      const name = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : null;
      return [id, { email: account?.user?.email || null, name }] as const;
    })));
    const items = await Promise.all(rows.map(async (item) => {
      let imageUrl: string | null = null;
      if (item.image_path) {
        const { data: signed } = await supabaseServer!.storage.from('community-photos')
          .createSignedUrl(item.image_path, 300);
        imageUrl = signed?.signedUrl || null;
      }
      const member = byId.get(item.author_id);
      const account = accounts.get(item.author_id);
      return { ...item, image_path: item.image_path ?? null,
        author_name: member?.nome || account?.name || null,
        author_email: member?.email || account?.email || null,
        avatar_url: item.content_type === 'person' ? member?.avatar_url || profileAvatar.get(item.author_id) || null : null,
        image_url: imageUrl };
    }));
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[community moderation] GET failed', error);
    return NextResponse.json({ error: 'Não foi possível carregar a fila da comunidade.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const access = await authorized(req);
  if (access.error) return access.error;
  try {
    const body = await req.json();
    if (!types.includes(body?.contentType) || !actions.includes(body?.action)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body?.contentId || '')
      || (body.contentType === 'person' && ['hide', 'restore'].includes(body.action))
      || (body.contentType !== 'person' && body.action === 'remove_avatar')
      || (body.action === 'escalate' && !String(body.note || '').trim())) {
      return NextResponse.json({ error: 'Decisão inválida.' }, { status: 400 });
    }
    const { error } = await supabaseServer!.rpc('review_community_report', {
      p_content_type: body.contentType,
      p_content_id: body.contentId,
      p_action: body.action,
      p_reviewer_email: access.user?.email,
      p_note: String(body.note || '').slice(0, 2000),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[community moderation] POST failed', error);
    return NextResponse.json({ error: 'Não foi possível registar a decisão.' }, { status: 500 });
  }
}
