import { APP_URL } from './config';

export const SITE_NAME = 'Apostolado de Garabandal';
export const BRAND_NAME = 'Apostolado de Garabandal';
export const ORGANIZATION_ID = `${APP_URL}/#organization`;
export const WEBSITE_ID = `${APP_URL}/#website`;

export const DEFAULT_OG_IMAGE = `${APP_URL}/opengraph-image`;
export const DEFAULT_PILGRIMAGE_IMAGES = [
  `${APP_URL}/images/nossasenhoragarabandal.jpg`,
  `${APP_URL}/images/igrejagarabandal.webp`,
  `${APP_URL}/images/meninasgarabandal.jpg`,
];

export const getAbsoluteUrl = (value?: string | null, fallback?: string) => {
  const url = String(value || '').trim();
  if (!url) return fallback;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${APP_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

export const getPilgrimageSeoImages = (coverImage?: string | null) =>
  Array.from(
    new Set([
      getAbsoluteUrl(coverImage),
      ...DEFAULT_PILGRIMAGE_IMAGES,
      DEFAULT_OG_IMAGE,
    ].filter(Boolean) as string[]),
  );

export const truncateMetaDescription = (value: string | null | undefined, fallback: string, max = 155) => {
  const text = String(value || fallback).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
};
