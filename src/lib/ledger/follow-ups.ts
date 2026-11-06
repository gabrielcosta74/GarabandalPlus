import 'server-only';

import { applyLearnedCategories } from './aliases';
import { enrichIncomingMovements, reclassifyOpenMovements } from './enrich';
import { syncFactptMirror } from './factpt-mirror';
import { closeInvoicedMovements } from './finish-confirmed';

/**
 * What runs after the bank is read, even when the read itself failed. Each step
 * is independent: one failing must never stop the others or the sync.
 */
export async function runLedgerFollowUps(options: { mirrorPages?: number } = {}) {
  const attempt = async <T>(label: string, step: () => Promise<T>): Promise<T | null> => {
    try {
      return await step();
    } catch (error) {
      console.error(`Contabilidade: falhou ${label}`, error);
      return null;
    }
  };
  const mirrorPages = options.mirrorPages ?? 30;
  const mirror = mirrorPages > 0
    ? await attempt('a cópia da FACT.pt', () => syncFactptMirror({ maxPages: mirrorPages }))
    : null;
  await attempt('a reclassificação', () => reclassifyOpenMovements());
  const enriched = await attempt('o cruzamento com a faturação', () => enrichIncomingMovements());
  const learned = await attempt('a aprendizagem', () => applyLearnedCategories());
  const finished = await attempt('o fecho dos movimentos com FR', () => closeInvoicedMovements());
  return { mirror, enriched, learned, finished };
}
