import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../lib/supabase';
import { logAdminAudit } from '../../../../../lib/admin-audit';

const bodySchema = z.object({
  stock: z.number().int().min(0).nullable().optional(),
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  price: z.number().min(0).optional(),
  currency: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  is_physical: z.boolean().optional(),
  image_url: z.string().nullable().optional(),
  digital_url: z.string().nullable().optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  factpt_reference: z.string().min(1).nullable().optional(),
  reason: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { productId: string } }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  try {
    const json = await request.json();
    const parsed = bodySchema.parse(json);

    const updatePayload: Record<string, any> = {};
    const stockProvided = Object.prototype.hasOwnProperty.call(parsed, 'stock');
    const nextStock = stockProvided ? parsed.stock : undefined;
    let previousStock: number | null = null;
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== undefined && key !== 'reason') updatePayload[key] = value;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ message: 'Sem dados para atualizar.' }, { status: 400 });
    }

    if (stockProvided) {
      const { data: existing } = await supabaseServer
        .from('store_products')
        .select('stock')
        .eq('product_id', params.productId)
        .maybeSingle();
      previousStock = typeof existing?.stock === 'number' ? existing.stock : null;
    }

    const { error } = await supabaseServer
      .from('store_products')
      .update(updatePayload)
      .eq('product_id', params.productId);

    if (error) {
      console.error('Erro ao atualizar stock:', error);
      return NextResponse.json({ message: 'Erro ao atualizar stock.' }, { status: 500 });
    }

    if (stockProvided && typeof nextStock === 'number') {
      const delta = typeof previousStock === 'number' ? nextStock - previousStock : nextStock;
      if (delta !== 0) {
        const authEmail = auth.user?.email || null;
        await supabaseServer.from('store_stock_movements').insert({
          product_id: params.productId,
          delta,
          reason: parsed.reason || 'Ajuste manual',
          admin_email: authEmail,
        });
      }
    }

    await logAdminAudit({
      adminEmail: auth.user?.email || null,
      action: 'update_product',
      details: {
        productId: params.productId,
        updatedFields: Object.keys(updatePayload),
        stock: stockProvided ? nextStock ?? null : null,
        previousStock: stockProvided ? previousStock ?? null : null,
        reason: parsed.reason || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Pedido inválido.' }, { status: 400 });
  }
}
