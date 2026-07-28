/**
 * Campanha Itália + Medjugorje (abril 2027) — corrida manual de um lote.
 *
 * O motor (audiência, exclusões, dedupe, envio, registo) vive em
 * `src/lib/italy-campaign.ts` e é o mesmo que o cron do Railway usa. Este script
 * é a porta manual: dry run com previews, ou um lote pontual.
 *
 * - DRY RUN é o modo por defeito: mostra a audiência real, grava previews PT/EN
 *   em emails/ e NÃO envia nada. O envio exige SEND=1 explícito.
 * - O calendário automático está em ITALY_SCHEDULE (mesmo ficheiro da lib).
 *
 * Uso:
 *   npx tsx scripts/send-italy-campaign.ts launch              # dry run + previews
 *   SEND=1 npx tsx scripts/send-italy-campaign.ts launch       # envia um lote
 *   SEND=1 MAX_SENDS=200 npx tsx scripts/send-italy-campaign.ts story
 *
 * Passos: launch · story · value · last-call
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
process.env.APP_URL = (process.env.APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');

const SEND = process.env.SEND === '1';
const MAX_SENDS = Math.max(1, Math.min(500, Number(process.env.MAX_SENDS || 300)));

async function main() {
  const { ITALY_STEPS, prepareItalyBatch, runItalyCampaignBatch } = await import('../src/lib/italy-campaign');

  const stepId = (process.argv[2] || '') as keyof typeof ITALY_STEPS;
  const step = ITALY_STEPS[stepId];
  if (!step) {
    console.error(`Uso: npx tsx scripts/send-italy-campaign.ts <${Object.keys(ITALY_STEPS).join('|')}>`);
    process.exit(1);
  }

  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Faltam env vars (RESEND_API_KEY / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL).');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!SEND) {
    // Preview real de cada língua, para abrir no browser antes de enviar.
    const prepared = await prepareItalyBatch(supabase, step, MAX_SENDS);
    console.log(`Campanha: ${step.name}`);
    console.log(
      `Peregrinação: ${prepared.pilgrimage.title} · ${prepared.pilgrimage.current_vacancies}/${prepared.pilgrimage.total_vacancies} vagas livres · estado ${prepared.pilgrimage.status}`,
    );
    console.log(`Câmbio: 1 EUR = ${prepared.rates.BRL.toFixed(2)} BRL · ${prepared.rates.USD.toFixed(2)} USD${prepared.rates.live ? '' : '  (fallback)'}`);
    console.log(`Inscritos excluídos: ${prepared.enrolledEmails.size} emails`);
    console.log(`Audiência contactável: ${prepared.audience.length}`);
    if (step.requires) console.log(`  → recebeu o passo anterior (${step.requires}): ${prepared.targeted.length}`);
    console.log(`  → já recebeu este email: ${prepared.alreadySent.size}`);
    console.log(`  → adiados pela regra 24h: ${prepared.pending.length - prepared.eligibleNow.length}`);
    console.log(`  → neste lote (teto ${MAX_SENDS}): ${prepared.batch.length}  (DRY RUN — nada será enviado)`);

    for (const locale of ['pt', 'en'] as const) {
      const matches = (contact: { language?: string | null }) => (contact.language === 'pt' ? 'pt' : 'en') === locale;
      const sample =
        prepared.batch.find(matches) ||
        prepared.audience.find(matches) ||
        ({ display_name: locale === 'en' ? 'Mary' : 'Maria', normalized_email: 'preview@example.com', language: locale } as any);
      const rendered = prepared.renderFor(sample as any);
      const out = path.resolve(process.cwd(), `emails/_preview-italy-${step.id}-${locale}.html`);
      fs.writeFileSync(out, rendered.html);
      console.log(`\n[${locale.toUpperCase()}] "${rendered.subject}"\n  preview: ${out}`);
    }
    console.log('\nDRY RUN concluído. Nenhum email enviado, nada registado. Para enviar: SEND=1 …');
    return;
  }

  const result = await runItalyCampaignBatch({ supabase, step, maxSends: MAX_SENDS, dryRun: false });
  console.log(`Campanha: ${step.name}`);
  console.log(`Inscritos excluídos: ${result.enrolledExcluded} · audiência ${result.audience} (PT ${result.audiencePt} · EN ${result.audienceEn})`);
  console.log(`Lote: ${result.batch} · enviados ${result.sent} · falhados ${result.failed}`);
  console.log(`Restam ${Math.max(0, result.remaining)} para próximas corridas.`);
}

main().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
