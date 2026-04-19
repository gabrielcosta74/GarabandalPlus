import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { translateBatch } from '../../../../lib/deepl';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

async function getSupabaseAdmin() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
}

/**
 * GET /api/admin/migrate-translations
 * Devolve o progresso actual (quantos registos têm tradução vs total)
 */
export async function GET(req: NextRequest) {
  const supabase = await getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const tables = [
    { table: 'pilgrimages', ptCol: 'title', enCol: 'title_en' },
    { table: 'store_products', ptCol: 'name', enCol: 'name_en' },
    { table: 'testimonials', ptCol: 'text', enCol: 'text_en' },
    { table: 'eventos', ptCol: 'titulo', enCol: 'titulo_en' },
    { table: 'member_contents', ptCol: 'title', enCol: 'title_en' },
    { table: 'academy_courses', ptCol: 'title', enCol: 'title_en' },
    { table: 'novenas', ptCol: 'title', enCol: 'title_en' },
    { table: 'prayers', ptCol: 'title', enCol: 'title_en' },
  ];

  const progress: Record<string, { total: number; translated: number }> = {};

  for (const { table, ptCol, enCol } of tables) {
    const { count: total } = await supabase.from(table).select('*', { count: 'exact', head: true });
    const { count: translated } = await supabase.from(table).select('*', { count: 'exact', head: true }).not(enCol, 'is', null);
    progress[table] = { total: total ?? 0, translated: translated ?? 0 };
  }

  return NextResponse.json({ progress });
}

/**
 * POST /api/admin/migrate-translations
 * Body: { table?: string } — se omitido, traduz todas as tabelas
 * Traduz em batch todos os registos sem tradução EN
 */
export async function POST(req: NextRequest) {
  const supabase = await getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!process.env.DEEPL_API_KEY) {
    return NextResponse.json({ error: 'DEEPL_API_KEY não configurada.' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const targetTable = body.table as string | undefined;

  // Configuração de cada tabela: quais campos traduzir
  const tableConfigs = [
    {
      table: 'pilgrimages',
      fields: [
        { pt: 'title', en: 'title_en' },
        { pt: 'description', en: 'description_en' },
        { pt: 'itinerary_summary', en: 'itinerary_summary_en' },
        { pt: 'meeting_point_text', en: 'meeting_point_text_en' },
        { pt: 'meeting_end_text', en: 'meeting_end_text_en' },
        { pt: 'flight_info_text', en: 'flight_info_text_en' },
        { pt: 'payment_plan_text', en: 'payment_plan_text_en' },
        { pt: 'cancellation_policy_text', en: 'cancellation_policy_text_en' },
        { pt: 'transport_description', en: 'transport_description_en' },
        { pt: 'accommodation_description', en: 'accommodation_description_en' },
        { pt: 'group_flight_details', en: 'group_flight_details_en' },
      ],
    },
    {
      table: 'store_products',
      fields: [
        { pt: 'name', en: 'name_en' },
        { pt: 'description', en: 'description_en' },
      ],
    },
    {
      table: 'store_categories',
      fields: [
        { pt: 'name', en: 'name_en' },
        { pt: 'description', en: 'description_en' },
      ],
    },
    {
      table: 'testimonials',
      fields: [
        { pt: 'text', en: 'text_en' },
        { pt: 'role', en: 'role_en' },
      ],
    },
    {
      table: 'eventos',
      fields: [
        { pt: 'titulo', en: 'titulo_en' },
        { pt: 'descricao', en: 'descricao_en' },
      ],
    },
    {
      table: 'member_contents',
      fields: [
        { pt: 'title', en: 'title_en' },
        { pt: 'description', en: 'description_en' },
      ],
    },
    {
      table: 'member_content_categories',
      fields: [{ pt: 'name', en: 'name_en' }],
    },
    {
      table: 'academy_courses',
      fields: [
        { pt: 'title', en: 'title_en' },
        { pt: 'description', en: 'description_en' },
      ],
    },
    {
      table: 'academy_episodes',
      fields: [
        { pt: 'title', en: 'title_en' },
        { pt: 'description', en: 'description_en' },
      ],
    },
    {
      table: 'novenas',
      fields: [
        { pt: 'title', en: 'title_en' },
        { pt: 'description', en: 'description_en' },
        { pt: 'prayer_intro', en: 'prayer_intro_en' },
        { pt: 'prayer_final', en: 'prayer_final_en' },
      ],
    },
    {
      table: 'prayers',
      fields: [
        { pt: 'title', en: 'title_en' },
        { pt: 'content', en: 'content_en' },
        { pt: 'preview', en: 'preview_en' },
      ],
    },
    {
      table: 'pilgrimage_itinerary_items',
      fields: [
        { pt: 'title', en: 'title_en' },
        { pt: 'description', en: 'description_en' },
      ],
    },
    {
      table: 'pilgrimage_team_members',
      fields: [
        { pt: 'role', en: 'role_en' },
        { pt: 'description', en: 'description_en' },
      ],
    },
  ];

  const configs = targetTable
    ? tableConfigs.filter(c => c.table === targetTable)
    : tableConfigs;

  if (configs.length === 0) {
    return NextResponse.json({ error: `Tabela desconhecida: ${targetTable}` }, { status: 400 });
  }

  const results: Record<string, { updated: number; skipped: number; error?: string }> = {};

  for (const config of configs) {
    let updated = 0;
    let skipped = 0;

    try {
      // Buscar todos os registos que ainda não têm title_en (ou o primeiro campo EN)
      const firstEnField = config.fields[0].en;
      const { data: rows, error } = await supabase
        .from(config.table)
        .select('id, ' + config.fields.map(f => f.pt).join(', '))
        .is(firstEnField, null);

      if (error) throw error;
      if (!rows || rows.length === 0) {
        results[config.table] = { updated: 0, skipped: 0 };
        continue;
      }

      const typedRows = rows as unknown as Array<Record<string, string | null> & { id: string }>;

      // Traduzir em batch por campo
      for (const row of typedRows) {
        const texts = config.fields.map(f => (row[f.pt] as string) ?? '');
        const nonEmpty = texts.some(t => t.trim());
        if (!nonEmpty) { skipped++; continue; }

        const translated = await translateBatch(texts);
        const update: Record<string, string | null> = {};
        config.fields.forEach((f, i) => {
          update[f.en] = translated[i] || null;
        });

        const { error: updateError } = await supabase
          .from(config.table)
          .update(update)
          .eq('id', row.id);

        if (updateError) { skipped++; continue; }
        updated++;
      }

      results[config.table] = { updated, skipped };
    } catch (err: any) {
      results[config.table] = { updated, skipped, error: err.message };
    }
  }

  return NextResponse.json({ results });
}
