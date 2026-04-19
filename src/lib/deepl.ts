/**
 * DeepL Translation Utility (server-side only)
 * Uses DeepL Free API — 500k chars/month gratuitos
 * https://www.deepl.com/docs-api
 */

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

export type DeepLTargetLang = 'EN-GB' | 'EN-US' | 'PT-PT' | 'PT-BR';

interface DeepLTranslation {
  detected_source_language: string;
  text: string;
}

interface DeepLResponse {
  translations: DeepLTranslation[];
}

function getApiKey(): string {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error('DEEPL_API_KEY não configurada nas variáveis de ambiente.');
  return key;
}

/**
 * Traduz um único texto para inglês (EN-GB)
 */
export async function translateText(
  text: string,
  targetLang: DeepLTargetLang = 'EN-GB'
): Promise<string> {
  if (!text?.trim()) return '';

  const apiKey = getApiKey();

  const body = new URLSearchParams({
    text,
    target_lang: targetLang,
    source_lang: 'PT',
    tag_handling: 'xml',
    preserve_formatting: '1',
  });

  const res = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `DeepL-Auth-Key ${apiKey}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepL API error ${res.status}: ${err}`);
  }

  const data: DeepLResponse = await res.json();
  return data.translations[0]?.text ?? '';
}

/**
 * Traduz múltiplos textos em batch (mais eficiente — uma só chamada à API)
 * Retorna array na mesma ordem dos inputs
 */
export async function translateBatch(
  texts: string[],
  targetLang: DeepLTargetLang = 'EN-GB'
): Promise<string[]> {
  const nonEmpty = texts.filter(t => t?.trim());
  if (nonEmpty.length === 0) return texts.map(() => '');

  const apiKey = getApiKey();

  // DeepL aceita múltiplos `text` params na mesma request
  const params = new URLSearchParams();
  params.append('target_lang', targetLang);
  params.append('source_lang', 'PT');
  params.append('tag_handling', 'xml');
  params.append('preserve_formatting', '1');

  texts.forEach(t => params.append('text', t ?? ''));

  const res = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `DeepL-Auth-Key ${apiKey}`,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepL API error ${res.status}: ${err}`);
  }

  const data: DeepLResponse = await res.json();
  return data.translations.map(t => t.text);
}

/**
 * Traduz os campos de texto de um objecto, ignorando campos vazios
 * Retorna um novo objecto com os campos traduzidos
 */
export async function translateObject(
  fields: Record<string, string | null | undefined>,
  targetLang: DeepLTargetLang = 'EN-GB'
): Promise<Record<string, string>> {
  const keys = Object.keys(fields);
  const values = keys.map(k => fields[k] ?? '');

  const translated = await translateBatch(values, targetLang);

  return Object.fromEntries(keys.map((k, i) => [k, translated[i]]));
}
