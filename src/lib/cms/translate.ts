import 'server-only';
import { sanitizeAndValidate } from './sanitize';

/**
 * Server-side translation of devotional CMS content via OpenAI. Shared by the
 * /api/admin/cms/translate route (single field, on demand from the editor) and
 * the translateGroup server action (batch: translate every missing locale).
 *
 * For kind='body' the output is HTML using only the tags our sanitizer accepts
 * and is sanitized again here before returning.
 */
export type TranslateKind = 'body' | 'title' | 'short';

const LOCALE_LABEL: Record<string, string> = {
  pt: 'European Portuguese',
  en: 'English',
  es: 'European Spanish',
  fr: 'French',
  it: 'Italian',
};

const SYSTEM_BODY = (sourceLocale: string, targetLocale: string) => `You are a careful translator of devotional Catholic content from ${LOCALE_LABEL[sourceLocale]} to ${LOCALE_LABEL[targetLocale]}.

Rules:
- Preserve the EXACT HTML structure: keep every <h1> <h2> <h3> <p> <ul> <ol> <li> <blockquote> <strong> <em> <a> <img> <iframe> tag and attribute as in the source. Do not invent tags.
- Do NOT translate href URLs, src URLs, or class/data-* attribute values. Keep them byte-identical.
- Translate alt="" and title="" attributes when present.
- Preserve <img> and <iframe> exactly where they are.
- Keep proper nouns in their canonical form (Garabandal, Conchita, Mari Loli, Jacinta, Mari Cruz, Padre Pio, Nossa Senhora do Carmo / Our Lady of Mount Carmel).
- Output ONLY the translated HTML. No commentary, no markdown, no code fences.`;

const SYSTEM_SHORT = (sourceLocale: string, targetLocale: string) => `Translate this short text from ${LOCALE_LABEL[sourceLocale]} to ${LOCALE_LABEL[targetLocale]}. Keep tone and proper nouns. Output ONLY the translation, no quotes or commentary.`;

export function isSupportedLocale(locale: string): boolean {
  return !!LOCALE_LABEL[locale];
}

export type TranslateResult =
  | { ok: true; translated: string }
  | { ok: false; status: number; message: string };

export async function translateText(opts: {
  source: string;
  sourceLocale: string;
  targetLocale: string;
  kind: TranslateKind;
}): Promise<TranslateResult> {
  const source = (opts.source ?? '').trim();
  const { sourceLocale, targetLocale, kind } = opts;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, status: 500, message: 'OpenAI key not configured' };
  if (!source) return { ok: false, status: 400, message: 'Empty source' };
  if (!LOCALE_LABEL[sourceLocale] || !LOCALE_LABEL[targetLocale]) {
    return { ok: false, status: 400, message: 'Unsupported locale' };
  }
  if (sourceLocale === targetLocale) {
    return { ok: false, status: 400, message: 'Source and target locale are equal' };
  }
  // Soft cap to keep cost predictable. Bodies above this would need chunking.
  if (source.length > 60_000) {
    return { ok: false, status: 413, message: 'Source too long (>60k chars). Split before translating.' };
  }

  const system = kind === 'body' ? SYSTEM_BODY(sourceLocale, targetLocale) : SYSTEM_SHORT(sourceLocale, targetLocale);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: source },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, status: 502, message: `OpenAI: ${errText.slice(0, 200)}` };
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  let translated = data.choices?.[0]?.message?.content?.trim() ?? '';

  // Strip accidental markdown fences if the model returned them
  translated = translated.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '');

  // Sanitize body output again so callers always get clean, storable HTML.
  if (kind === 'body') translated = sanitizeAndValidate(translated);

  return { ok: true, translated };
}
