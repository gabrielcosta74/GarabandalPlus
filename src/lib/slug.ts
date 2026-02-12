export const slugify = (value: string): string => {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
};

export const buildProductPath = (id: string, name?: string | null): string => {
  const slug = name ? slugify(name) : '';
  return `/loja/${id}${slug ? `-${slug}` : ''}`;
};

export const extractProductId = (param: string): string => {
  const uuidMatch = param.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/);
  if (uuidMatch) return uuidMatch[0];
  return param;
};
