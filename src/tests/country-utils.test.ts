import { describe, expect, it } from 'vitest';
import { getPostalInvalidMessage, listCountryOptions, resolveCountryCode } from '../lib/country-utils';
import { buildProductPath } from '../lib/slug';
import { localizeStoreProductText, translateStoreCategory } from '../lib/store-i18n';

describe('country utilities', () => {
  it('exposes a broad English country list for public forms', () => {
    const countries = listCountryOptions('en');
    const labels = countries.map((country) => country.label);

    expect(countries.length).toBeGreaterThan(100);
    expect(countries).toContainEqual({ code: 'GB', label: 'United Kingdom' });
    expect(countries).toContainEqual({ code: 'US', label: 'United States' });
    expect(labels).not.toEqual(['Portugal', 'Brasil']);
  });

  it('returns validation messages in English when requested', () => {
    expect(getPostalInvalidMessage('GB', 'en')).toContain('Invalid postal code');
  });

  it('resolves codes and localized names across the whole country list', () => {
    for (const { code } of listCountryOptions('en')) {
      expect(resolveCountryCode(code)).toBe(code);
    }
    expect(resolveCountryCode('United States')).toBe('US');
    expect(resolveCountryCode('Estados Unidos')).toBe('US');
    expect(resolveCountryCode('Brasil')).toBe('BR');
    expect(resolveCountryCode('Angola')).toBe('AO');
    expect(resolveCountryCode('Outro')).toBeNull();
    expect(resolveCountryCode('')).toBeNull();
    expect(resolveCountryCode(null)).toBeNull();
  });
});

describe('store i18n utilities', () => {
  it('builds English product URLs under /en/store', () => {
    expect(buildProductPath('abc123', 'Livro de Teste', 'en')).toBe('/en/store/abc123-livro-de-teste');
  });

  it('uses English product translations with Portuguese fallback', () => {
    const product = localizeStoreProductText({
      name: 'Livro',
      name_en: 'Book',
      description: 'Descrição',
      description_en: 'Description',
      category: 'Livro Físico',
      type_id: 'book_physical',
    }, 'en');

    expect(product.name).toBe('Book');
    expect(product.description).toBe('Description');
    expect(product.category).toBe('Books');
  });

  it('uses known English fallbacks for current store products while DB translations are empty', () => {
    const product = localizeStoreProductText({
      name: 'A História de Garabandal para Crianças - PDF',
      description: '',
      category: 'Livros Digitais',
      type_id: 'book_digital',
    }, 'en');

    expect(product.name).toBe('The Story of Garabandal for Children - PDF');
    expect(product.description).toContain('Digital PDF book');
    expect(product.category).toBe('Digital Books');
  });

  it('translates known store categories for English pages', () => {
    expect(translateStoreCategory('Artigo Religioso', 'religious_article', 'en')).toBe('Religious Articles');
    expect(translateStoreCategory('Vestuário', 'clothing', 'en')).toBe('Clothing');
  });
});
