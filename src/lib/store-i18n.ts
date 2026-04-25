import { type AppLocale } from './locale-routing';

type LocalizableProduct = {
  name?: string | null;
  name_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  category?: string | null;
  type_id?: string | null;
};

const normalizeText = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const KNOWN_PRODUCT_NAME_EN: Record<string, string> = {
  'a historia de garabandal para criancas - pdf': 'The Story of Garabandal for Children - PDF',
  'diario de conchita - versao digital em portugues': "Conchita's Diary - Digital Version in Portuguese",
  'guia do peregrino - garabandal (portugues / espanhol) - pdf': "Pilgrim's Guide - Garabandal (Portuguese / Spanish) - PDF",
  'livro - garabandal, um chamamento urgente a conversao': 'Book - Garabandal, An Urgent Call to Conversion',
};

const KNOWN_PRODUCT_DESCRIPTION_PT: Record<string, string> = {
  'a historia de garabandal para criancas - pdf':
    'Livro digital em PDF para apresentar a mensagem de Garabandal às crianças de forma simples, catequética e acessível.',
  'diario de conchita - versao digital em portugues':
    'Versão digital em português do Diário de Conchita, um testemunho essencial para conhecer os acontecimentos e a mensagem de Garabandal.',
  'guia do peregrino - garabandal (portugues / espanhol) - pdf':
    'Guia digital para peregrinos em Garabandal, com apoio prático e espiritual em português e espanhol para preparar a visita.',
  'livro - garabandal, um chamamento urgente a conversao':
    'Livro físico sobre Garabandal e o chamamento urgente à conversão, pensado para formação espiritual e aprofundamento da mensagem mariana.',
};

const KNOWN_PRODUCT_DESCRIPTION_EN: Record<string, string> = {
  'a historia de garabandal para criancas - pdf':
    'Digital PDF book created to introduce children to the message of Garabandal in a simple, catechetical and accessible way.',
  'diario de conchita - versao digital em portugues':
    "Portuguese digital edition of Conchita's Diary, an essential testimony for understanding the events and message of Garabandal.",
  'guia do peregrino - garabandal (portugues / espanhol) - pdf':
    'Digital pilgrim guide for Garabandal, with practical and spiritual support in Portuguese and Spanish to help prepare the visit.',
  'livro - garabandal, um chamamento urgente a conversao':
    'Physical book about Garabandal and the urgent call to conversion, created for spiritual formation and deeper study of the Marian message.',
};

const getEnglishProductNameFallback = (name?: string | null) => {
  const original = String(name || '').trim();
  if (!original) return 'Product';
  return KNOWN_PRODUCT_NAME_EN[normalizeText(original)] || original;
};

export const getPortugueseProductDescriptionFallback = (name?: string | null) =>
  KNOWN_PRODUCT_DESCRIPTION_PT[normalizeText(name)] || '';

export const getEnglishProductDescriptionFallback = (name?: string | null) =>
  KNOWN_PRODUCT_DESCRIPTION_EN[normalizeText(name)] || '';

export const getStoreHomePath = (locale: AppLocale) => (locale === 'en' ? '/en/store' : '/loja');

export const getStoreCheckoutPath = (locale: AppLocale) =>
  locale === 'en' ? '/en/store/checkout' : '/loja-online/checkout';

export const getStoreLocaleLabel = (locale: AppLocale, pt: string, en: string) =>
  locale === 'en' ? en : pt;

export const translateStoreCategory = (
  category: string | null | undefined,
  typeId: string | null | undefined,
  locale: AppLocale,
) => {
  const value = String(category || '').trim();
  if (locale !== 'en') return value || 'Geral';

  const normalizedCategory = normalizeText(value);
  const normalizedType = normalizeText(typeId);

  if (normalizedType.includes('book') || normalizedCategory.includes('livro')) {
    return normalizedType.includes('digital') || normalizedCategory.includes('digital') ? 'Digital Books' : 'Books';
  }
  if (normalizedType.includes('clothing') || normalizedCategory.includes('vestu') || normalizedCategory.includes('roupa')) {
    return 'Clothing';
  }
  if (normalizedCategory.includes('artigo') || normalizedCategory.includes('religioso')) {
    return 'Religious Articles';
  }
  if (normalizedCategory.includes('digital') || normalizedType.includes('digital')) {
    return 'Digital';
  }
  if (normalizedCategory.includes('outro')) return 'Other';
  return value || 'General';
};

export const localizeStoreProductText = <T extends LocalizableProduct>(
  product: T,
  locale: AppLocale,
): T & { name: string; description: string; category: string } => {
  const name = locale === 'en'
    ? String(product.name_en || getEnglishProductNameFallback(product.name))
    : String(product.name || 'Produto');
  const description = locale === 'en'
    ? String(product.description_en || getEnglishProductDescriptionFallback(product.name) || product.description || '')
    : String(product.description || getPortugueseProductDescriptionFallback(product.name) || '');
  const category = translateStoreCategory(product.category, product.type_id, locale);

  return {
    ...product,
    name,
    description,
    category,
  };
};

export const getStoreProductTypeText = (isPhysical: boolean, locale: AppLocale) => ({
  tag: isPhysical ? getStoreLocaleLabel(locale, 'Fisico', 'Physical') : 'Digital',
  format: isPhysical ? getStoreLocaleLabel(locale, 'Produto físico', 'Physical product') : getStoreLocaleLabel(locale, 'PDF digital', 'Digital PDF'),
});
