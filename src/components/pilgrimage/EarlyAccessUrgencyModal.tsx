'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flame, X } from 'lucide-react';

interface Props {
    slug: string;
    isEn?: boolean;
}

const storageKey = (slug: string) => `early-access-urgency:${slug}`;

/**
 * One-time marketing pop-up for visitors who got in with the early-access code:
 * high demand, first to register keeps their place. Qualitative only — never
 * states exact vacancy numbers. Shown once per browser session.
 */
export default function EarlyAccessUrgencyModal({ slug, isEn = false }: Props) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let alreadySeen = false;
        try {
            alreadySeen = sessionStorage.getItem(storageKey(slug)) === '1';
        } catch {
            // storage unavailable: fall through and show it
        }
        if (alreadySeen) return;
        const id = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(id);
    }, [slug]);

    const close = () => {
        setOpen(false);
        try {
            sessionStorage.setItem(storageKey(slug), '1');
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    const t = isEn
        ? {
            tag: 'Early access',
            title: 'Demand is high — your place is at risk',
            body: 'This pilgrimage is attracting a lot of interest and spots can fill up quickly. Those who register first are the ones who secure their place.',
            note: 'Register early so you don’t miss out.',
            cta: 'Got it, show me the pilgrimage',
            closeLabel: 'Close',
        }
        : {
            tag: 'Acesso antecipado',
            title: 'Alta procura — risco de perder a sua vaga',
            body: 'Esta peregrinação está a despertar muito interesse e as vagas podem esgotar rapidamente. Quem se inscreve primeiro é quem garante o seu lugar.',
            note: 'Inscreva-se cedo para não ficar de fora.',
            cta: 'Entendido, ver a peregrinação',
            closeLabel: 'Fechar',
        };

    // Portal to <body> with the max z-index so the sticky booking bar, cookie
    // banner and chat button never sit on top of the pop-up.
    return createPortal(
        <div
            className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="early-access-urgency-title"
            onClick={close}
        >
            <div
                className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-gradient-to-r from-red-600 to-amber-500 px-6 py-5 text-white">
                    <button
                        type="button"
                        onClick={close}
                        aria-label={t.closeLabel}
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-widest">
                        <Flame className="h-3.5 w-3.5" strokeWidth={2.5} />
                        {t.tag}
                    </div>
                    <h2 id="early-access-urgency-title" className="pr-8 text-xl font-black leading-tight sm:text-2xl">
                        {t.title}
                    </h2>
                </div>
                <div className="px-6 py-5">
                    <p className="text-sm leading-relaxed text-slate-700 sm:text-base">{t.body}</p>
                    <p className="mt-3 text-sm font-bold text-red-600">{t.note}</p>
                    <button
                        type="button"
                        onClick={close}
                        className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-slate-800"
                    >
                        {t.cta}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
