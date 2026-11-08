import { format } from 'date-fns';
import { enUS, pt } from 'date-fns/locale';
import { parseCivilDate } from '../../../lib/utils';

export type EditionPilgrimage = {
    id: string;
    slug: string;
    title: string;
    title_en?: string | null;
    description?: string | null;
    description_en?: string | null;
    itinerary_summary?: string | null;
    itinerary_summary_en?: string | null;
    cover_image?: string | null;
    cover_image_en?: string | null;
    start_date: string;
    end_date: string;
    status: string;
    total_vacancies: number;
    current_vacancies?: number;
    confirmed_pax: number;
    effective_vacancies: number;
    pricing_config?: { scarcity_fill_pct?: number } | null;
};

export const remainingSpotsOf = (p: EditionPilgrimage) => {
    const effective = Number(p.effective_vacancies);
    const current = Number(p.current_vacancies);
    if (Number.isFinite(effective)) return Math.max(0, effective);
    if (Number.isFinite(current)) return Math.max(0, current);
    return Math.max(0, Number(p.total_vacancies || 0) - Number(p.confirmed_pax || 0));
};

export const titleOf = (p: EditionPilgrimage, isEn: boolean) => (isEn && p.title_en ? p.title_en : p.title);

/** "Peregrinação a Garabandal - Caminho Mariano - Outubro 2027" → "Caminho Mariano". */
export const shortTitleOf = (p: EditionPilgrimage, isEn: boolean) => {
    const parts = titleOf(p, isEn).split(/\s[-–—]\s/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 3) return parts[1];
    if (parts.length === 2) return parts[0].replace(/^(Peregrinação|Pilgrimage)\s+(a|à|to)\s+/i, '');
    return parts[0] || titleOf(p, isEn);
};

export const dateRangeOf = (p: EditionPilgrimage, isEn: boolean) => {
    const locale = isEn ? enUS : pt;
    const start = parseCivilDate(p.start_date);
    const end = parseCivilDate(p.end_date);
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    return {
        days: `${format(start, 'd')}—${format(end, 'd')}`,
        monthYear: sameMonth
            ? format(start, 'MMMM yyyy', { locale })
            : `${format(start, 'MMM', { locale })} — ${format(end, 'MMM yyyy', { locale })}`,
        label: isEn
            ? `${format(start, 'MMM d', { locale })} — ${format(end, 'MMM d, yyyy', { locale })}`
            : `${format(start, 'd MMM', { locale })} — ${format(end, 'd MMM yyyy', { locale })}`,
        duration: Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1,
    };
};

export const stopsOf = (p: EditionPilgrimage, isEn: boolean) => {
    const raw = (isEn && p.itinerary_summary_en) ? p.itinerary_summary_en : p.itinerary_summary;
    return String(raw || '')
        .split(/\s*[-–—•]\s+|\s+[-–—•]\s*/)
        .map((s) => s.replace(/\.$/, '').trim())
        .filter(Boolean);
};
