import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../lib/supabase';
import { generateMemberDiplomaPdf } from '../../../../../lib/member-diploma';
import { logAdminAudit } from '../../../../../lib/admin-audit';
import { sendMemberReceiptEmail, sendMemberDiplomaEmail, sendMembershipNotification } from '../../../../../lib/email';

const formatISODate = (date: Date) => date.toISOString().slice(0, 10);

const calculateNextQuotaDate = (currentDueDate?: string | null) => {
  const today = new Date();
  if (currentDueDate) {
    const currentDue = new Date(currentDueDate);
    return new Date(currentDue.getFullYear() + 1, 0, 31);
  }
  const jan31CurrentYear = new Date(today.getFullYear(), 0, 31);
  if (today <= jan31CurrentYear) return jan31CurrentYear;
  return new Date(today.getFullYear() + 1, 0, 31);
};

const getNextMemberNumber = async (supabase: any) => {
  const { data, error } = await supabase
    .from('membros')
    .select('numero_socio')
    .not('numero_socio', 'is', null)
    .order('numero_socio', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const current = Number(data?.numero_socio ?? 0);
  return Number.isFinite(current) && current > 0 ? current + 1 : 1;
};

const patchSchema = z
  .object({
    nome: z.string().min(1).optional(),
    email: z.string().email().optional(),
    telefone: z.string().optional(),
    address: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
    nif: z.string().optional(),
    numero_socio: z.number().int().positive().optional(),
    estado_quota: z.string().optional(),
    proxima_quota: z.string().optional(),
    tipo_subscricao: z.string().optional(),
    is_membro: z.boolean().optional(),
    data_adesao: z.string().optional().nullable(),
  })
  .strict();

const actionSchema = z.object({
  action: z.enum(['mark_paid', 'resend_receipt', 'resend_diploma', 'register_payment']),
});

const logAdminAction = async (input: {
  adminEmail?: string | null;
  memberId: string;
  action: string;
  details?: Record<string, any>;
}) => {
  await logAdminAudit({
    adminEmail: input.adminEmail,
    memberId: input.memberId,
    action: input.action,
    details: input.details || null,
  });
};

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  const memberId = decodeURIComponent(params.id);
  console.log('[admin/members] lookup', { memberId });
  const selectFields =
    'id, nome, email, telefone, address, postal_code, country, nif, numero_socio, estado_quota, proxima_quota, tipo_subscricao, is_membro, data_adesao';

  let { data: memberRows, error } = await supabaseServer
    .from('membros')
    .select(selectFields)
    .eq('id', memberId)
    .limit(1);
  let member = memberRows?.[0] ?? null;
  console.log('[admin/members] by id', { found: !!member, error: error?.message || null });

  if (!member && !error) {
    if (memberId.includes('@')) {
      const emailValue = memberId.trim();
      let emailResult = await supabaseServer
        .from('membros')
        .select(selectFields)
        .ilike('email', emailValue)
        .limit(1);
      console.log('[admin/members] by email ilike', {
        found: !!emailResult.data?.[0],
        error: emailResult.error?.message || null,
      });
      if (!emailResult.data?.length) {
        emailResult = await supabaseServer
          .from('membros')
          .select(selectFields)
          .eq('email', emailValue.toLowerCase())
          .limit(1);
        console.log('[admin/members] by email eq', {
          found: !!emailResult.data?.[0],
          error: emailResult.error?.message || null,
        });
      }
      member = emailResult.data?.[0] ?? null;
      error = emailResult.error;
    } else if (/^\d+$/.test(memberId)) {
      const numero = Number(memberId);
      const numberResult = await supabaseServer
        .from('membros')
        .select(selectFields)
        .eq('numero_socio', numero)
        .limit(1);
      console.log('[admin/members] by numero_socio', {
        found: !!numberResult.data?.[0],
        error: numberResult.error?.message || null,
      });
      member = numberResult.data?.[0] ?? null;
      error = numberResult.error;
    }
  }

  if (error || !member) {
    return NextResponse.json({ message: 'Membro não encontrado.' }, { status: 404 });
  }

  const { data: payments } = await supabaseServer
    .from('pagamentos_quotas')
    .select('id, valor, estado, metodo_pagamento, data_pagamento, external_reference')
    .eq('user_id', memberId)
    .order('data_pagamento', { ascending: false })
    .limit(20);

  return NextResponse.json({ member, payments: payments || [] });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  const payload = patchSchema.parse(await request.json());
  if (!Object.keys(payload).length) {
    return NextResponse.json({ message: 'Sem dados para atualizar.' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('membros')
    .update(payload)
    .eq('id', params.id)
    .select()
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: 'Erro ao atualizar membro.' }, { status: 500 });
  }

  await logAdminAction({
    adminEmail: auth.user?.email || null,
    memberId: params.id,
    action: 'update_member',
    details: payload,
  });

  return NextResponse.json({ member: data });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  const body = await request.json();
  const { action } = actionSchema.parse(body);

  const { data: member, error: memberError } = await supabaseServer
    .from('membros')
    .select('id, nome, email, numero_socio, estado_quota, proxima_quota, tipo_subscricao, is_membro, data_adesao, diploma_enviado_at')
    .eq('id', params.id)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json({ message: 'Membro não encontrado.' }, { status: 404 });
  }

  if (action === 'resend_receipt') {
    const { data: paymentRow } = await supabaseServer
      .from('pagamentos_quotas')
      .select('valor, metodo_pagamento, external_reference, data_pagamento, estado')
      .eq('user_id', member.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!member.email || !paymentRow) {
      return NextResponse.json({ message: 'Sem dados suficientes para reenviar recibo.' }, { status: 400 });
    }

    await sendMemberReceiptEmail({
      toEmail: member.email,
      memberName: member.nome ?? null,
      memberNumber: member.numero_socio ?? undefined,
      amount: Number(paymentRow.valor || 0),
      currency: 'EUR',
      paymentMethod: paymentRow.metodo_pagamento || 'manual',
      paymentReference: paymentRow.external_reference || null,
      nextQuotaDate: member.proxima_quota || null,
      paidAt: paymentRow.data_pagamento || new Date().toISOString(),
      kind: member.is_membro ? 'renewal' : 'new',
      hasDiploma: false,
    });

    await logAdminAction({
      adminEmail: auth.user?.email || null,
      memberId: member.id,
      action: 'resend_receipt',
      details: { paymentReference: paymentRow.external_reference || null },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'resend_diploma') {
    if (!member.email || !member.numero_socio) {
      return NextResponse.json({ message: 'Membro sem email ou numero de socio.' }, { status: 400 });
    }
    const pdfBytes = await generateMemberDiplomaPdf({
      memberName: member.nome || member.email,
      memberNumber: Number(member.numero_socio),
      issuedAt: new Date().toISOString(),
    });

    await sendMemberDiplomaEmail({
      toEmail: member.email,
      memberName: member.nome ?? null,
      memberNumber: Number(member.numero_socio),
      issuedAt: new Date().toISOString(),
      attachments: [
        {
          filename: `diploma-socio-${member.numero_socio}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: 'application/pdf',
        },
      ],
    });

    await supabaseServer
      .from('membros')
      .update({ diploma_enviado_at: new Date().toISOString() })
      .eq('id', member.id);

    await logAdminAction({
      adminEmail: auth.user?.email || null,
      memberId: member.id,
      action: 'resend_diploma',
      details: { memberNumber: member.numero_socio },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'mark_paid') {
    const wasMember = !!member.is_membro;
    let numero_socio = member.numero_socio;
    if (!numero_socio || !wasMember) {
      numero_socio = await getNextMemberNumber(supabaseServer);
    }

    const nextQuotaDate = calculateNextQuotaDate(member.proxima_quota);
    const todayIso = formatISODate(new Date());
    const paymentRef = `admin_${Date.now()}`;

    await supabaseServer
      .from('membros')
      .update({
        is_membro: true,
        estado_quota: 'pago',
        proxima_quota: formatISODate(nextQuotaDate),
        numero_socio,
        data_adesao: member.data_adesao || todayIso,
      })
      .eq('id', member.id);

    await supabaseServer.from('pagamentos_quotas').insert({
      user_id: member.id,
      valor: 25,
      metodo_pagamento: 'admin_manual',
      estado: 'pago',
      payment_intent_id: null,
      external_reference: paymentRef,
      data_pagamento: todayIso,
    });

    if (member.email) {
      let diplomaAttachment;
      const shouldAttachDiploma = !wasMember && !member.diploma_enviado_at && numero_socio;
      if (shouldAttachDiploma) {
        const pdfBytes = await generateMemberDiplomaPdf({
          memberName: member.nome || member.email,
          memberNumber: Number(numero_socio),
          issuedAt: todayIso,
        });
        diplomaAttachment = {
          filename: `diploma-socio-${numero_socio}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: 'application/pdf',
        };
      }

      await sendMemberReceiptEmail({
        toEmail: member.email,
        memberName: member.nome ?? null,
        memberNumber: numero_socio ?? undefined,
        amount: 25,
        currency: 'EUR',
        paymentMethod: 'admin_manual',
        paymentReference: paymentRef,
        nextQuotaDate: formatISODate(nextQuotaDate),
        paidAt: new Date().toISOString(),
        kind: wasMember ? 'renewal' : 'new',
        attachments: diplomaAttachment ? [diplomaAttachment] : undefined,
        hasDiploma: !!diplomaAttachment,
      });

      if (diplomaAttachment) {
        await supabaseServer
          .from('membros')
          .update({ diploma_enviado_at: new Date().toISOString() })
          .eq('id', member.id);
      }
    }

    await sendMembershipNotification({
      kind: wasMember ? 'renewal' : 'new',
      memberName: member.nome ?? null,
      memberEmail: member.email ?? null,
      memberNumber: numero_socio ?? null,
      amount: 25,
      currency: 'EUR',
      paymentMethod: 'admin_manual',
      paymentReference: paymentRef,
      nextQuotaDate: formatISODate(nextQuotaDate),
      paidAt: new Date().toISOString(),
    });

    await logAdminAction({
      adminEmail: auth.user?.email || null,
      memberId: member.id,
      action: 'mark_paid',
      details: { paymentReference: paymentRef, amount: 25 },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'register_payment') {
    const paymentSchema = z.object({
      amount: z.number().positive(),
      date: z.string(), // ISO date
      method: z.string(),
      notes: z.string().optional(),
      update_quota: z.boolean().optional(),
    });

    // Reuse body parsed above
    const payload = paymentSchema.safeParse(body);

    if (!payload.success) {
      return NextResponse.json({ message: 'Dados de pagamento inválidos.', errors: payload.error }, { status: 400 });
    }

    const { amount, date, method, notes, update_quota } = payload.data;
    const todayIso = formatISODate(new Date());
    const paymentRef = `admin_manual_${Date.now()}`;

    // Insert payment record
    const { error: paymentError } = await supabaseServer.from('pagamentos_quotas').insert({
      user_id: member.id,
      valor: amount,
      metodo_pagamento: method,
      estado: 'pago',
      payment_intent_id: null, // No real payment intent
      external_reference: paymentRef, // Unique ref
      data_pagamento: date || todayIso,
    });

    if (paymentError) {
      console.error('Error inserting manual payment:', paymentError);
      return NextResponse.json({ message: 'Erro ao registar pagamento.' }, { status: 500 });
    }

    // Optionally update quota status
    if (update_quota) {
      const nextQuotaDate = calculateNextQuotaDate(member.proxima_quota);
      await supabaseServer
        .from('membros')
        .update({
          estado_quota: 'pago',
          proxima_quota: formatISODate(nextQuotaDate),
          is_membro: true, // Ensure they are marked as active member
        })
        .eq('id', member.id);
    }

    await logAdminAction({
      adminEmail: auth.user?.email || null,
      memberId: member.id,
      action: 'register_manual_payment',
      details: { amount, method, notes, update_quota },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: 'Acao invalida.' }, { status: 400 });
}
