import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

// Public endpoint: allows non-logged-in visitors to submit a prayer intention.
// Inserts via the service role so RLS (which restricts inserts to auth.uid() = user_id)
// does not block anonymous guests.
export async function POST(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Erro de configuração' }, { status: 500 });
  }

  let body: { intention_text?: string; guest_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
  }

  const intentionText = (body.intention_text ?? '').trim();
  if (!intentionText) {
    return NextResponse.json({ error: 'A intenção não pode estar vazia' }, { status: 400 });
  }

  const guestName = (body.guest_name ?? '').trim().slice(0, 120) || null;

  const { error } = await supabaseServer
    .from('prayer_intentions')
    .insert({
      intention_text: intentionText.slice(0, 2000),
      candle_type: 'free',
      amount: 0.0,
      status: 'pending',
      guest_name: guestName,
    });

  if (error) {
    console.error('Public intention insert error:', error);
    return NextResponse.json({ error: 'Erro ao enviar a intenção' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
