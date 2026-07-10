export const getPriceValidUntil = () => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
};

type ProductReviewMetadata = Record<string, unknown> | null | undefined;
type ProductMetadata = Record<string, unknown> | null | undefined;

export type ProductReviewSummary = {
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
  review?: {
    authorName: string;
    ratingValue: number;
    body: string;
    datePublished?: string;
  };
};

const getMetadataValue = (metadata: ProductMetadata, keys: string[]) => {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
};

const parseFiniteNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseRating = (value: unknown) => {
  const rating = parseFiniteNumber(value);
  if (rating === null || rating < 1 || rating > 5) return null;
  return Number(rating.toFixed(1));
};

const parsePositiveInteger = (value: unknown) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseText = (value: unknown, maxLength = 500) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, maxLength) : null;
};

const parseIsoDate = (value: unknown) => {
  const text = parseText(value, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const parseIdentifier = (value: unknown, maxLength = 80) => {
  const text = parseText(value, maxLength);
  return text || null;
};

const parseNumericIdentifier = (value: unknown) => {
  const text = String(value || '').replace(/[^\d]/g, '');
  return text || null;
};

export const getProductSchemaType = (isBook: boolean) => (isBook ? ['Product', 'Book'] : 'Product');

export const buildProductBrand = (name = 'Apostolado de Garabandal') => ({
  '@type': 'Brand',
  name,
});

export const buildProductIdentifierStructuredData = (
  metadata: ProductMetadata,
  options: {
    isBook?: boolean;
    sku?: string | null;
    productId?: string | null;
  } = {},
) => {
  const gtin = parseNumericIdentifier(getMetadataValue(metadata, ['gtin', 'gtin13', 'gtin14', 'gtin12', 'gtin8']));
  const gtin8 = parseNumericIdentifier(getMetadataValue(metadata, ['gtin8']));
  const gtin12 = parseNumericIdentifier(getMetadataValue(metadata, ['gtin12', 'upc']));
  const gtin13 = parseNumericIdentifier(getMetadataValue(metadata, ['gtin13', 'ean']));
  const gtin14 = parseNumericIdentifier(getMetadataValue(metadata, ['gtin14']));
  const isbn = parseIdentifier(getMetadataValue(metadata, ['isbn']), 32);
  const mpn =
    parseIdentifier(getMetadataValue(metadata, ['mpn', 'manufacturer_part_number']), 80) ||
    parseIdentifier(options.sku || options.productId, 80);

  return {
    brand: buildProductBrand(),
    sku: options.sku || options.productId || undefined,
    productID: options.productId || options.sku || undefined,
    ...(gtin ? { gtin } : {}),
    ...(gtin8 ? { gtin8 } : {}),
    ...(gtin12 ? { gtin12 } : {}),
    ...(gtin13 ? { gtin13 } : {}),
    ...(gtin14 ? { gtin14 } : {}),
    ...(options.isBook && isbn ? { isbn } : {}),
    ...(mpn ? { mpn } : {}),
  };
};

export const buildProductReviewSummary = (metadata: ProductReviewMetadata): ProductReviewSummary => {
  const summary: ProductReviewSummary = {};

  const aggregateRatingValue = parseRating(
    getMetadataValue(metadata, ['rating_value', 'aggregate_rating', 'average_rating']),
  );
  const aggregateReviewCount = parsePositiveInteger(
    getMetadataValue(metadata, ['review_count', 'rating_count', 'reviews_count']),
  );

  if (aggregateRatingValue !== null && aggregateReviewCount !== null) {
    summary.aggregateRating = {
      ratingValue: aggregateRatingValue,
      reviewCount: aggregateReviewCount,
    };
  }

  const reviewAuthor = parseText(getMetadataValue(metadata, ['review_author', 'reviewer_name']), 100);
  const reviewBody = parseText(getMetadataValue(metadata, ['review_body', 'review_text', 'review']), 500);
  const reviewRating = parseRating(getMetadataValue(metadata, ['review_rating', 'review_rating_value']));
  const reviewDate = parseIsoDate(getMetadataValue(metadata, ['review_date', 'date_published']));

  if (reviewAuthor && reviewBody && reviewRating !== null) {
    summary.review = {
      authorName: reviewAuthor,
      body: reviewBody,
      ratingValue: reviewRating,
      ...(reviewDate ? { datePublished: reviewDate } : {}),
    };
  }

  return summary;
};

export const buildProductReviewStructuredData = (
  metadata: ProductReviewMetadata,
  productName?: string | null,
) => {
  const summary = buildProductReviewSummary(metadata);

  return {
    ...(summary.aggregateRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: summary.aggregateRating.ratingValue,
            bestRating: 5,
            worstRating: 1,
            reviewCount: summary.aggregateRating.reviewCount,
          },
        }
      : {}),
    ...(summary.review
      ? {
          review: {
            '@type': 'Review',
            name: productName ? `Avaliação de ${productName}` : 'Avaliação do produto',
            reviewBody: summary.review.body,
            reviewRating: {
              '@type': 'Rating',
              ratingValue: summary.review.ratingValue,
              bestRating: 5,
              worstRating: 1,
            },
            author: {
              '@type': 'Person',
              name: summary.review.authorName,
            },
            ...(summary.review.datePublished ? { datePublished: summary.review.datePublished } : {}),
          },
        }
      : {}),
  };
};

export const buildMerchantReturnPolicy = (isDigital: boolean) => ({
  '@type': 'MerchantReturnPolicy',
  applicableCountry: ['BR', 'PT'],
  returnPolicyCategory: isDigital
    ? 'https://schema.org/MerchantReturnNotPermitted'
    : 'https://schema.org/MerchantReturnFiniteReturnWindow',
  ...(!isDigital
    ? {
        merchantReturnDays: 30,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      }
    : {}),
});

const normalizeCountryCode = (value: unknown) => String(value || '').trim().toUpperCase();

const getSupportedShippingCountries = (allowedCountries?: unknown[] | null) => {
  const allowed = Array.isArray(allowedCountries)
    ? allowedCountries.map(normalizeCountryCode).filter(Boolean)
    : [];
  const candidates = allowed.length > 0 ? allowed : ['PT', 'BR'];
  return candidates.filter((country) => country === 'PT' || country === 'BR');
};

export const buildOfferShippingDetails = (
  isDigital: boolean,
  currency = 'EUR',
  allowedCountries?: unknown[] | null,
) => {
  if (isDigital) return undefined;

  const countries = getSupportedShippingCountries(allowedCountries);
  if (countries.length === 0) return undefined;

  return countries.map((country) => ({
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: '0',
      currency,
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: country,
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 0,
        maxValue: 2,
        unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: country === 'PT' ? 1 : 5,
        maxValue: country === 'PT' ? 5 : 15,
        unitCode: 'DAY',
      },
    },
  }));
};
