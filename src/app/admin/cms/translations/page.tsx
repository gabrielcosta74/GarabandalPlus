import { TranslationAudit } from '../../../../components/cms/TranslationAudit';
import { TranslationOverview } from '../../../../components/cms/TranslationOverview';
import {
  cmsTranslationCoverage,
  cmsTranslationOverview,
  type CmsContentType,
  type TranslationCoverageFilter,
} from '../../../../lib/cms/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Traduções' };

export default async function TranslationsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const type = ((sp.type as string) ?? 'page') as CmsContentType;
  const filterRaw = (sp.filter as string) ?? 'missing-en';
  const validFilters: TranslationCoverageFilter[] = ['all', 'missing-en', 'missing-es', 'missing-fr', 'missing-it', 'missing-pt', 'pt-only', 'complete'];
  const filter = (validFilters.includes(filterRaw as TranslationCoverageFilter)
    ? (filterRaw as TranslationCoverageFilter)
    : 'missing-en');

  // Overview aggregates + per-filter totals for the pills, plus the visible rows.
  const [overview, all, missingEn, missingEs, missingFr, missingIt, missingPt, complete, visible] = await Promise.all([
    cmsTranslationOverview(type),
    cmsTranslationCoverage(type, 'all'),
    cmsTranslationCoverage(type, 'missing-en'),
    cmsTranslationCoverage(type, 'missing-es'),
    cmsTranslationCoverage(type, 'missing-fr'),
    cmsTranslationCoverage(type, 'missing-it'),
    cmsTranslationCoverage(type, 'missing-pt'),
    cmsTranslationCoverage(type, 'complete'),
    cmsTranslationCoverage(type, filter),
  ]);

  return (
    <main className="cms-page-shell">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          Traduções
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.95rem', margin: '0.25rem 0 0' }}>
          Vê quanto conteúdo existe em cada língua (PT · EN · ES · FR · IT), por categoria, e cria automaticamente as traduções em falta.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <TranslationOverview type={type} overview={overview} />

        <TranslationAudit
          type={type}
          rows={visible}
          filter={filter}
          totals={{
            all: all.length,
            missingEn: missingEn.length,
            missingEs: missingEs.length,
            missingFr: missingFr.length,
            missingIt: missingIt.length,
            missingPt: missingPt.length,
            complete: complete.length,
          }}
        />
      </div>
    </main>
  );
}
