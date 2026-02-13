type ProductKindInput = {
  isPhysical?: boolean | null;
  typeId?: string | null;
  category?: string | null;
  name?: string | null;
  digitalUrl?: string | null;
};

const normalizeText = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function inferIsDigitalProduct(input: ProductKindInput): boolean {
  const typeId = normalizeText(input.typeId);
  const category = normalizeText(input.category);
  const name = normalizeText(input.name);
  const hasDigitalUrl = !!normalizeText(input.digitalUrl);

  const isDigitalType =
    typeId === 'book_digital' ||
    typeId === 'event_ticket' ||
    typeId === 'digital_generic' ||
    typeId.includes('digital') ||
    typeId.includes('pdf');

  if (input.isPhysical === false) return true;
  if (isDigitalType) return true;
  if (hasDigitalUrl) return true;

  // Legacy fallback: category is digital and content/title signals digital format.
  const categoryLooksDigital =
    category.includes('digit') ||
    category.includes('e-book') ||
    category.includes('ebook') ||
    category.includes('pdf');
  const nameLooksDigital =
    name.includes('pdf') ||
    name.includes('digital') ||
    name.includes('e-book') ||
    name.includes('ebook');

  return categoryLooksDigital && nameLooksDigital;
}

