type ProductImageMetadata = Record<string, unknown> | null | undefined;

type MerchantProductCopy = {
  title: string;
  description: string;
};

const MERCHANT_PRODUCT_COPY: Record<string, MerchantProductCopy> = {
  '200000048': {
    title: 'Garabandal: Um Chamamento Urgente à Conversão - Livro Físico',
    description:
      'Livro físico de 360 páginas sobre a história, as mensagens e os testemunhos de Garabandal. Uma leitura para compreender o chamamento à conversão e aprofundar a fé. Envio para Portugal e Brasil.',
  },
  '200000056': {
    title: 'História de Garabandal para Crianças - Livro Digital Ilustrado (PDF)',
    description:
      'Livro digital ilustrado que apresenta a história e a mensagem de Garabandal às crianças com linguagem simples. Ideal para leitura em família e catequese, com download imediato em PDF.',
  },
  '200000057': {
    title: 'Guia do Peregrino de Garabandal - Português e Espanhol (PDF)',
    description:
      'Guia digital bilingue para preparar a peregrinação a Garabandal. Inclui mapa da aldeia, locais de visita, percurso aos Pinos e informações práticas em português e espanhol. Download imediato.',
  },
  '978-989-33-8094--9': {
    title: 'Diário de Conchita - Livro Digital em Português (PDF)',
    description:
      'Edição digital em português do Diário de Conchita, testemunho essencial sobre as aparições, os acontecimentos e a mensagem de Garabandal. Leitura imediata em telemóvel, tablet ou computador.',
  },
};

const CURATED_ADDITIONAL_IMAGE_PATHS: Record<string, string[]> = {
  '200000056': [
    '/images/store/products/200000056/preview-01.jpg',
    '/images/store/products/200000056/preview-02.jpg',
  ],
  '200000057': [
    '/images/store/products/200000057/preview-01.jpg',
    '/images/store/products/200000057/preview-02.jpg',
    '/images/store/products/200000057/preview-03.jpg',
  ],
  '978-989-33-8094--9': [
    '/images/store/products/978-989-33-8094--9/preview-01.jpg',
    '/images/store/products/978-989-33-8094--9/preview-02.jpg',
  ],
};

const getImageUrl = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of ['url', 'src', 'image_url']) {
    const candidate = String(record[key] || '').trim();
    if (candidate) return candidate;
  }
  return null;
};

const getMetadataImageUrls = (metadata: ProductImageMetadata) => {
  if (!metadata) return [];
  const values = [
    metadata.additional_image_urls,
    metadata.additional_images,
    metadata.gallery_images,
    metadata.images,
  ];

  return values.flatMap((value) => {
    if (Array.isArray(value)) return value.map(getImageUrl).filter((url): url is string => Boolean(url));
    if (typeof value === 'string') {
      return value
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean);
    }
    const url = getImageUrl(value);
    return url ? [url] : [];
  });
};

export const getMerchantProductTitle = (productId: string, fallback: string) =>
  MERCHANT_PRODUCT_COPY[productId]?.title || fallback;

export const getMerchantProductDescription = (productId: string, fallback?: string | null) => {
  const description = String(fallback || '').replace(/\s+/g, ' ').trim();
  return (description || MERCHANT_PRODUCT_COPY[productId]?.description || '').slice(0, 5000);
};

export const getAdditionalProductImageUrls = (
  productId: string,
  metadata?: ProductImageMetadata,
  primaryImage?: string | null,
) => {
  const urls = [
    ...getMetadataImageUrls(metadata),
    ...(CURATED_ADDITIONAL_IMAGE_PATHS[productId] || []),
  ];
  const primary = String(primaryImage || '').trim();
  return Array.from(new Set(urls.filter((url) => url && url !== primary))).slice(0, 10);
};

export const toAbsoluteStoreImageUrl = (url: string, baseUrl: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
};
