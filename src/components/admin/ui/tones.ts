/** Paleta partilhada do painel admin: chips, badges e pontos coordenados. */
export type Tone = 'slate' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet' | 'teal';

export const TONE_CHIP: Record<Tone, string> = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-200/70',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-200/70',
    amber: 'bg-amber-50 text-amber-600 ring-amber-200/70',
    sky: 'bg-sky-50 text-sky-600 ring-sky-200/70',
    rose: 'bg-rose-50 text-rose-600 ring-rose-200/70',
    violet: 'bg-violet-50 text-violet-600 ring-violet-200/70',
    teal: 'bg-teal-50 text-teal-600 ring-teal-200/70',
};

export const TONE_BADGE: Record<Tone, string> = {
    slate: 'bg-slate-50 text-slate-600 ring-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    teal: 'bg-teal-50 text-teal-700 ring-teal-200',
};

export const TONE_DOT: Record<Tone, string> = {
    slate: 'bg-slate-400',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    sky: 'bg-sky-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-500',
    teal: 'bg-teal-500',
};
