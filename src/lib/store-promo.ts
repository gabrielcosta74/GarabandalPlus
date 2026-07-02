type PromoProduct = {
  name?: string | null;
  category?: string | null;
  type_id?: string | null;
  typeId?: string | null;
  isPhysical?: boolean | null;
  is_physical?: boolean | null;
};

export const STORE_BOOK_PROMO = {
  id: 'garabandal-first-apparition-2026',
  discountRate: 0.15,
  endsAtIso: '2026-07-03T03:00:00.000Z',
  timeZone: 'America/Sao_Paulo',
};

const normalizeText = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const isStoreBookPromoActive = (now = Date.now()) =>
  now < new Date(STORE_BOOK_PROMO.endsAtIso).getTime();

export const getStoreBookPromoRemainingMs = (now = Date.now()) =>
  Math.max(0, new Date(STORE_BOOK_PROMO.endsAtIso).getTime() - now);

export const isStoreBookProduct = (product: PromoProduct) => {
  const category = normalizeText(product.category);
  const type = normalizeText(product.type_id || product.typeId);
  const name = normalizeText(product.name);

  return (
    type.includes('book') ||
    category.includes('livro') ||
    category.includes('book') ||
    name.includes('livro') ||
    name.includes('book') ||
    name.includes('diario') ||
    name.includes('diary')
  );
};

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const getStoreBookPromo = (product: PromoProduct, now = Date.now()) => {
  if (!isStoreBookPromoActive(now) || !isStoreBookProduct(product)) return null;

  return STORE_BOOK_PROMO;
};

export const applyStoreBookPromo = (price: number, product: PromoProduct, now = Date.now()) => {
  const promo = getStoreBookPromo(product, now);
  const originalPrice = Number(price || 0);

  if (!promo) {
    return {
      active: false,
      originalPrice,
      discountedPrice: originalPrice,
      discountAmount: 0,
      discountRate: 0,
      promo: null,
    };
  }

  const discountedPrice = roundMoney(originalPrice * (1 - promo.discountRate));

  return {
    active: true,
    originalPrice,
    discountedPrice,
    discountAmount: roundMoney(originalPrice - discountedPrice),
    discountRate: promo.discountRate,
    promo,
  };
};
