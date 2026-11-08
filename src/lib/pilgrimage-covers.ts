// Imagens da listagem pública (/peregrinacoes e /en/pilgrimages).
// Cada peregrinação usa SEMPRE a sua própria capa (cover_image / cover_image_en
// na BD). A foto do hero é uma foto real de grupo, da galeria.

export type PilgrimageCover = {
    src: string;
    alt: { pt: string; en: string };
};

export const PILGRIMAGES_HERO_IMAGE: PilgrimageCover = {
    src: '/images/peregrinacoes/garabandal-pinheiros-grupo.webp',
    alt: {
        pt: 'Grupo de peregrinos junto aos Pinheiros de Garabandal',
        en: 'Pilgrim group at the Pines of Garabandal',
    },
};

export function getPilgrimageCover(
    pilgrimage: { title?: string | null; title_en?: string | null; cover_image?: string | null; cover_image_en?: string | null },
    locale: 'pt' | 'en',
): { src: string | null; alt: string } {
    const src = locale === 'en'
        ? pilgrimage.cover_image_en || pilgrimage.cover_image || null
        : pilgrimage.cover_image || null;
    const title = locale === 'en' ? pilgrimage.title_en || pilgrimage.title : pilgrimage.title;
    return { src, alt: title || '' };
}
