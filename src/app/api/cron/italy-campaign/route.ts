import { NextResponse } from 'next/server';
import {
  ITALY_SCHEDULE,
  ITALY_STEPS,
  findItalyScheduleEntry,
  italySlotForHour,
  lisbonDate,
  lisbonHour,
  runItalyCampaignBatch,
  type ItalyStepId,
} from '../../../../lib/italy-campaign';
import { isWithinMarketingSendWindow } from '../../../../lib/marketing-limits';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Um lote de 200 emails a 650ms leva ~2,5 min; a margem cobre retries.
export const maxDuration = 800;

/**
 * Cron da campanha Itália + Medjugorje.
 *
 * O Railway corre este endpoint às 13:00 e 20:00 UTC (14:00 e 21:00 de Lisboa)
 * de terça a quinta. O que é enviado — passo e tamanho do lote — vem do
 * calendário `ITALY_SCHEDULE`: se o dia/slot de hoje não estiver lá, a corrida
 * não faz nada. Assim a campanha termina sozinha no fim do calendário, sem
 * ninguém ter de desligar o cron.
 *
 * Parâmetros (só para testes manuais):
 *   ?dryRun=1        → devolve as contagens sem enviar nem registar nada
 *   ?step=&max=      → força passo/lote, ignorando o calendário
 */
export async function GET(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
  }

  const secret = process.env.CRON_SECRET || '';
  if (!secret) {
    return NextResponse.json({ message: 'CRON_SECRET não configurado.' }, { status: 500 });
  }
  if ((req.headers.get('authorization') || '') !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dryRun') === '1';
    const forcedStep = url.searchParams.get('step') as ItalyStepId | null;
    const forcedMax = Number(url.searchParams.get('max') || 0);

    const now = new Date();
    const today = lisbonDate(now);
    const hour = lisbonHour(now);
    const slot = italySlotForHour(hour);

    const entry = forcedStep ? null : findItalyScheduleEntry(now);
    const step = forcedStep ? ITALY_STEPS[forcedStep] : entry ? ITALY_STEPS[entry.step] : null;
    const maxSends = forcedStep ? Math.max(1, Math.min(500, forcedMax || 100)) : entry?.maxSends || 0;

    if (!step) {
      const remaining = ITALY_SCHEDULE.filter((row) => row.date >= today).length;
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: slot ? 'no_schedule_entry' : 'outside_slot_hours',
        lisbon: { date: today, hour, slot },
        remainingScheduledRuns: remaining,
      });
    }

    // Quiet hours do público (hora de São Paulo). As 14:00/21:00 de Lisboa caem
    // dentro da janela; esta guarda protege corridas manuais fora de horas.
    if (!dryRun && !isWithinMarketingSendWindow()) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'outside_send_window',
        lisbon: { date: today, hour, slot },
        step: step.id,
      });
    }

    const result = await runItalyCampaignBatch({
      supabase: supabaseServer,
      step,
      maxSends,
      dryRun,
    });

    return NextResponse.json({
      ok: true,
      skipped: false,
      lisbon: { date: today, hour, slot },
      forced: Boolean(forcedStep),
      maxSends,
      ...result,
    });
  } catch (error: any) {
    console.error('[cron/italy-campaign]', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
