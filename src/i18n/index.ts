import { pt } from './locales/pt';
import { en } from './locales/en';

export type LocaleCode = 'pt' | 'en';
export type Translations = typeof pt;

export const translations = { pt, en } as const;

export function getTranslations(locale: LocaleCode): Translations {
  return locale === 'en' ? (en as unknown as Translations) : pt;
}

export { pt, en };
