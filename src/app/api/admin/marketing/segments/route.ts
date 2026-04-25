import { NextResponse } from 'next/server';
import { DEFAULT_MARKETING_SEGMENTS } from '../../../../../lib/marketing-core';
import { buildMarketingContacts } from '../../../../../lib/marketing-data';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const [contacts, { data: rows }] = await Promise.all([
      buildMarketingContacts(auth.supabase),
      auth.supabase.from('marketing_segments').select('*').order('is_system', { ascending: false }).order('name'),
    ]);

    const persisted = rows || [];
    const merged = persisted.length > 0 ? persisted : DEFAULT_MARKETING_SEGMENTS;
    const segments = merged.map((segment: any) => ({
      ...segment,
      count: contacts.filter((contact) => contact.segments.includes(segment.slug)).length,
    }));

    return NextResponse.json({ segments });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar segmentos.');
  }
}

export async function POST(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const name = String(body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    const slug = slugify(String(body?.slug || name));

    const { data, error } = await auth.supabase
      .from('marketing_segments')
      .insert({
        name,
        slug,
        description: body?.description || null,
        rules: body?.rules || {},
        is_system: false,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ segment: data });
  } catch (error) {
    return jsonError(error, 'Não foi possível criar segmento.');
  }
}

export async function PATCH(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

    const { data, error } = await auth.supabase
      .from('marketing_segments')
      .update({
        name: body.name,
        description: body.description,
        rules: body.rules || {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .eq('is_system', false)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ segment: data });
  } catch (error) {
    return jsonError(error, 'Não foi possível atualizar segmento.');
  }
}
