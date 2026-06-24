/**
 * Phase A5 helper — generates the 12 thin route files for the category landing
 * pages (6 categories × 2 locales). Each file just delegates to
 * CategoryIndexPage with the right key and locale, behind the preview gate.
 *
 * Idempotent. Run once after editing CATEGORIES or this script.
 *   npx tsx scripts/generate-category-routes.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const CATEGORIES = {
  historia: { pt: 'historia', en: 'history' },
  ensinamentos: { pt: 'ensinamentos', en: 'teachings' },
  mensagens: { pt: 'mensagens', en: 'messages' },
  testemunhos: { pt: 'testemunhos', en: 'testimonies' },
  profecias: { pt: 'profecias', en: 'prophecies' },
  noticias: { pt: 'noticias', en: 'news' },
} as const;

const ROOT = path.resolve(__dirname, '..');

function ptTemplate(catKey: string, slug: string): string {
  return `import type { Metadata } from 'next';
import { CategoryIndexPage } from '../../components/content/CategoryIndexPage';
import { CATEGORIES } from '../../lib/cms/categories';
import { isPreviewSession } from '../../lib/content/preview';
import { APP_URL } from '../../lib/config';
import { notFound } from 'next/navigation';

export const revalidate = 600;
const CAT = '${catKey}' as const;
const cfg = CATEGORIES[CAT];

export async function generateMetadata(): Promise<Metadata> {
  if (!(await isPreviewSession())) return { title: cfg.pt.label, robots: { index: false, follow: false } };
  return {
    title: cfg.pt.label,
    description: cfg.pt.tagline,
    alternates: {
      canonical: \`\${APP_URL}/\${cfg.pt.slug}\`,
      languages: {
        'pt-BR': \`\${APP_URL}/\${cfg.pt.slug}\`,
        en: \`\${APP_URL}/en/\${cfg.en.slug}\`,
      },
    },
  };
}

export default async function Page() {
  if (!(await isPreviewSession())) notFound();
  return <CategoryIndexPage category={CAT} locale="pt" />;
}
`;
}

function enTemplate(catKey: string, slug: string): string {
  return `import type { Metadata } from 'next';
import { CategoryIndexPage } from '../../../components/content/CategoryIndexPage';
import { CATEGORIES } from '../../../lib/cms/categories';
import { isPreviewSession } from '../../../lib/content/preview';
import { APP_URL } from '../../../lib/config';
import { notFound } from 'next/navigation';

export const revalidate = 600;
const CAT = '${catKey}' as const;
const cfg = CATEGORIES[CAT];

export async function generateMetadata(): Promise<Metadata> {
  if (!(await isPreviewSession())) return { title: cfg.en.label, robots: { index: false, follow: false } };
  return {
    title: cfg.en.label,
    description: cfg.en.tagline,
    alternates: {
      canonical: \`\${APP_URL}/en/\${cfg.en.slug}\`,
      languages: {
        'pt-BR': \`\${APP_URL}/\${cfg.pt.slug}\`,
        en: \`\${APP_URL}/en/\${cfg.en.slug}\`,
      },
    },
  };
}

export default async function Page() {
  if (!(await isPreviewSession())) notFound();
  return <CategoryIndexPage category={CAT} locale="en" />;
}
`;
}

let written = 0;
for (const [catKey, { pt, en }] of Object.entries(CATEGORIES)) {
  const ptDir = path.join(ROOT, 'src/app', pt);
  const enDir = path.join(ROOT, 'src/app/en', en);
  fs.mkdirSync(ptDir, { recursive: true });
  fs.mkdirSync(enDir, { recursive: true });
  const ptFile = path.join(ptDir, 'page.tsx');
  const enFile = path.join(enDir, 'page.tsx');
  fs.writeFileSync(ptFile, ptTemplate(catKey, pt));
  fs.writeFileSync(enFile, enTemplate(catKey, en));
  written += 2;
  console.log(`  ✓ ${ptFile.replace(ROOT + '/', '')}`);
  console.log(`  ✓ ${enFile.replace(ROOT + '/', '')}`);
}
console.log(`\nWrote ${written} route files.`);
