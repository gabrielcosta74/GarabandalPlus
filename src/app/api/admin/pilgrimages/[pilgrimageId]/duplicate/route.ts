import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../../lib/admin-logger';

const toBaseSlug = (slug?: string | null) => {
  const raw = (slug || 'peregrinacao').toLowerCase().trim();
  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || 'peregrinacao';
};

async function getUniqueSlug(base: string): Promise<string> {
  if (!supabaseServer) return `${base}-copia`;
  const root = `${base}-copia`;
  let slug = root;
  let i = 2;

  // Keep trying until we find a free slug.
  while (true) {
    const { data, error } = await supabaseServer
      .from('pilgrimages')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return slug;
    slug = `${root}-${i}`;
    i += 1;
  }
}

function sanitizeForInsert<T extends Record<string, any>>(row: T): Partial<T> {
  const copy = { ...row };
  delete (copy as any).id;
  delete (copy as any).created_at;
  delete (copy as any).updated_at;
  return copy;
}

type DuplicateSummary = {
  table: string;
  copied: number;
  skippedDuplicates: number;
  totalSourceRows: number;
};

type DuplicateOptions = {
  dedupeKey?: (row: Record<string, any>) => string;
  orderBy?: string[];
};

const normalizeText = (value: unknown) =>
  (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeCoordinate = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return numeric.toFixed(6);
};

function compareByFields(a: Record<string, any>, b: Record<string, any>, fields: string[]) {
  for (const field of fields) {
    const aValue = a?.[field];
    const bValue = b?.[field];

    if (aValue == null && bValue != null) return 1;
    if (aValue != null && bValue == null) return -1;
    if (aValue == null && bValue == null) continue;

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      if (aValue !== bValue) return aValue - bValue;
      continue;
    }

    const aText = aValue.toString();
    const bText = bValue.toString();
    if (aText !== bText) return aText.localeCompare(bText);
  }
  return 0;
}

async function duplicateChildTable(
  table: string,
  sourcePilgrimageId: string,
  targetPilgrimageId: string,
  options: DuplicateOptions = {}
): Promise<DuplicateSummary> {
  if (!supabaseServer) {
    return { table, copied: 0, skippedDuplicates: 0, totalSourceRows: 0 };
  }
  const { data, error } = await supabaseServer
    .from(table)
    .select('*')
    .eq('pilgrimage_id', sourcePilgrimageId);

  if (error) throw error;
  if (!data || data.length === 0) {
    return { table, copied: 0, skippedDuplicates: 0, totalSourceRows: 0 };
  }

  const orderedData = [...data];
  if (options.orderBy && options.orderBy.length > 0) {
    orderedData.sort((a, b) => compareByFields(a, b, options.orderBy!));
  }

  const dedupedRows: Record<string, any>[] = [];
  let skippedDuplicates = 0;
  const seen = new Set<string>();

  for (const row of orderedData) {
    if (options.dedupeKey) {
      const key = options.dedupeKey(row);
      if (seen.has(key)) {
        skippedDuplicates += 1;
        continue;
      }
      seen.add(key);
    }
    dedupedRows.push(row);
  }

  const rows: Record<string, any>[] = dedupedRows.map((row: any) => ({
    ...sanitizeForInsert(row),
    pilgrimage_id: targetPilgrimageId,
  }));

  if (table === 'pilgrimage_stages') {
    rows.forEach((row, index) => {
      row.display_order = index + 1;
    });
  }

  if (table === 'pilgrimage_itinerary_items') {
    rows.forEach((row, index) => {
      const day = Number(row.day_number);
      row.day_number = Number.isFinite(day) && day > 0 ? day : index + 1;
      row.display_order = index + 1;
    });
  }

  if (rows.length === 0) {
    return { table, copied: 0, skippedDuplicates, totalSourceRows: data.length };
  }

  const { error: insertError } = await supabaseServer.from(table).insert(rows);
  if (insertError) throw insertError;

  return {
    table,
    copied: rows.length,
    skippedDuplicates,
    totalSourceRows: data.length,
  };
}

export async function POST(
  req: Request,
  { params }: { params: { pilgrimageId: string } }
) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const { authorized, user, error: authError } = await verifyAdmin(req);
    if (!authorized || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const sourceId = params.pilgrimageId;
    const { data: original, error: originalError } = await supabaseServer
      .from('pilgrimages')
      .select('*')
      .eq('id', sourceId)
      .single();

    if (originalError || !original) {
      return NextResponse.json({ error: 'Peregrinação não encontrada' }, { status: 404 });
    }

    const baseSlug = toBaseSlug(original.slug);
    const newSlug = await getUniqueSlug(baseSlug);
    const newTitle = `${original.title || 'Peregrinação'} (Cópia)`;

    const newPilgrimageRow: Record<string, any> = {
      ...sanitizeForInsert(original),
      title: newTitle,
      slug: newSlug,
      status: 'closed',
    };

    const { data: created, error: createError } = await supabaseServer
      .from('pilgrimages')
      .insert(newPilgrimageRow)
      .select('*')
      .single();

    if (createError || !created) {
      return NextResponse.json({ error: createError?.message || 'Falha ao duplicar peregrinação' }, { status: 500 });
    }

    const newPilgrimageId = created.id as string;

    const stageSummary = await duplicateChildTable('pilgrimage_stages', sourceId, newPilgrimageId, {
      dedupeKey: (row) => [
        normalizeText(row.title),
        normalizeText(row.description),
        normalizeText(row.image_url),
        normalizeCoordinate(row.lat),
        normalizeCoordinate(row.lng),
      ].join('|'),
      orderBy: ['display_order', 'created_at'],
    });

    const itinerarySummary = await duplicateChildTable('pilgrimage_itinerary_items', sourceId, newPilgrimageId, {
      dedupeKey: (row) => [
        Number.isFinite(Number(row.day_number)) ? Number(row.day_number).toString() : '',
        normalizeText(row.title),
        normalizeText(row.description),
        normalizeText(row.image_url),
      ].join('|'),
      orderBy: ['day_number', 'display_order', 'created_at'],
    });

    const teamSummary = await duplicateChildTable('pilgrimage_team_members', sourceId, newPilgrimageId, {
      orderBy: ['display_order', 'created_at'],
    });
    const installmentSummary = await duplicateChildTable('installment_plans', sourceId, newPilgrimageId, {
      orderBy: ['created_at'],
    });

    await logAdminAction(user.email, 'DUPLICATE_PILGRIMAGE', { sourceId, newPilgrimageId }, newPilgrimageId);

    return NextResponse.json({
      success: true,
      pilgrimage: {
        id: created.id,
        title: created.title,
        slug: created.slug,
      },
      summary: {
        stages: stageSummary,
        itinerary: itinerarySummary,
        team: teamSummary,
        installments: installmentSummary,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao duplicar peregrinação' },
      { status: 500 }
    );
  }
}
