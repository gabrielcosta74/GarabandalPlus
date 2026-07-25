'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, AlertCircle } from 'lucide-react';

export interface GateInfo {
    title?: string | null;
    title_en?: string | null;
    cover_image?: string | null;
    cover_image_en?: string | null;
    public_launch_at?: string | null;
}

interface Props {
    slug: string;
    gateInfo: GateInfo;
    isEn?: boolean;
    /** Called after a valid code unlocks access. */
    onUnlocked: () => void;
}

const fmtCountdown = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`;
    return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
};

// Decorative barcode — pure CSS bars, no data.
const Barcode = () => (
    <div className="flex h-full items-stretch gap-[2px]" aria-hidden>
        {[2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 2].map((w, i) => (
            <span key={i} className="bg-white/70" style={{ width: `${w}px` }} />
        ))}
    </div>
);

/**
 * Invite-only access gate, styled as an exclusive "Early Access Pass". The
 * pilgrimage cover sits in the background (darkened, cinematic); a minimal
 * ticket-style card carries the elegant serif invite + code field. Full-screen
 * takeover above all site chrome; scroll locked.
 */
export default function PilgrimageAccessGate({ slug, gateInfo, isEn = false, onUnlocked }: Props) {
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [now, setNow] = useState(() => Date.now());

    const cover = (isEn && gateInfo.cover_image_en) || gateInfo.cover_image || '';
    const title = (isEn && gateInfo.title_en) || gateInfo.title || '';
    const launchTs = gateInfo.public_launch_at ? Date.parse(gateInfo.public_launch_at) : NaN;
    const hasLaunch = Number.isFinite(launchTs);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    useEffect(() => {
        if (!hasLaunch) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [hasLaunch]);

    useEffect(() => {
        if (hasLaunch && launchTs - now <= 0) onUnlocked();
    }, [hasLaunch, launchTs, now, onUnlocked]);

    const t = isEn
        ? {
            brand: 'Apostolado de Garabandal',
            pass: 'Exclusive Access',
            sub: 'Private invitation',
            line: 'One of the most sought-after pilgrimages by Apostolado de Garabandal. Places sell out fast.',
            opens: 'Public in',
            placeholder: 'Access code',
            enter: 'Enter',
            invalid: 'Invalid code.',
            helper: 'Shared in the private WhatsApp group',
        }
        : {
            brand: 'Apostolado de Garabandal',
            pass: 'Acesso Exclusivo',
            sub: 'Convite privado',
            line: 'Uma das peregrinações mais procuradas do Apostolado de Garabandal. As vagas esgotam rápido.',
            opens: 'Público em',
            placeholder: 'Código de acesso',
            enter: 'Entrar',
            invalid: 'Código inválido.',
            helper: 'Partilhado no grupo privado de WhatsApp',
        };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim() || status === 'loading') return;
        setStatus('loading');
        try {
            const res = await fetch('/api/pilgrimages/verify-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, code: code.trim() }),
            });
            if (res.ok) {
                // In `?gate=1` preview mode the gate is forced to stay; a valid
                // code should still take you through, so drop the query and do a
                // clean reload. Normal flow just refetches in place.
                if (typeof window !== 'undefined' && window.location.search.includes('gate=1')) {
                    window.location.href = window.location.pathname;
                    return;
                }
                onUnlocked();
                return;
            }
            setStatus('error');
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black" style={{ colorScheme: 'dark' }}>
            {/* Cover in the background — darkened, cinematic */}
            {cover && (
                <Image src={cover} alt="" fill priority className="object-cover opacity-40 blur-[3px]" sizes="100vw" />
            )}
            <div className="absolute inset-0 bg-black/60" />
            <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{ background: 'repeating-radial-gradient(circle at 50% 46%, transparent 0 118px, rgba(255,255,255,0.045) 118px 120px)' }}
            />
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 46%, transparent 40%, rgba(0,0,0,0.85) 100%)' }} />

            {/* The pass */}
            <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-5 py-12">
                <div className="w-full max-w-[27rem]">
                    <div className="relative rounded-[24px] border border-white/12 bg-white/[0.055] shadow-[0_40px_100px_-25px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
                        {/* dashed ticket outline */}
                        <div className="pointer-events-none absolute inset-[9px] rounded-[16px] border border-dashed border-white/12" />

                        <div className="relative px-7 pt-7">
                            {/* Header row: brand + serial */}
                            <div className="flex items-start justify-between gap-4">
                                <p className="text-[9.5px] font-semibold uppercase tracking-[0.32em] text-white/45">{t.brand}</p>
                                <p className="shrink-0 font-mono text-[9px] tracking-widest text-white/30">N.º 001</p>
                            </div>

                            {/* Title block + barcode stub */}
                            <div className="mt-5 flex items-end justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">{t.sub}</p>
                                    <h1 className="mt-1.5 font-serif text-[2.15rem] font-medium leading-[1.05] tracking-tight text-white">{t.pass}</h1>
                                </div>
                                <div className="mb-1 h-9 shrink-0"><Barcode /></div>
                            </div>

                            <p className="mt-4 font-serif text-[15px] italic leading-snug text-white/70">{title}</p>
                            <p className="mt-2.5 text-[12.5px] leading-relaxed text-white/45">{t.line}</p>

                            {hasLaunch && (
                                <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
                                    {t.opens}
                                    <span className="font-mono tracking-normal text-amber-200/90">{fmtCountdown(launchTs - now)}</span>
                                </div>
                            )}
                        </div>

                        {/* Perforation */}
                        <div className="relative my-6">
                            <div className="absolute -left-[9px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-black" />
                            <div className="absolute -right-[9px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-black" />
                            <div className="mx-6 border-t border-dashed border-white/15" />
                        </div>

                        {/* Tear-off: code entry */}
                        <div className="px-7 pb-7">
                            <form onSubmit={submit}>
                                <div className={`flex items-center gap-2 rounded-2xl border bg-black/25 p-1.5 pl-5 transition-colors ${
                                    status === 'error' ? 'border-red-400/60' : 'border-white/12 focus-within:border-amber-200/50'
                                }`}>
                                    <input
                                        value={code}
                                        onChange={(e) => { setCode(e.target.value); if (status === 'error') setStatus('idle'); }}
                                        placeholder={t.placeholder}
                                        autoFocus
                                        autoComplete="off"
                                        autoCapitalize="characters"
                                        spellCheck={false}
                                        className="min-w-0 flex-1 bg-transparent py-3 text-center text-base font-semibold uppercase tracking-[0.3em] text-white placeholder:text-xs placeholder:font-medium placeholder:tracking-[0.2em] placeholder:text-white/30 focus:outline-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={status === 'loading' || !code.trim()}
                                        aria-label={t.enter}
                                        className="group flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-amber-100 to-amber-300 px-5 text-sm font-bold tracking-tight text-black transition-all hover:from-white hover:to-amber-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {status === 'loading' ? (
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                                        ) : (
                                            <>
                                                <span>{t.enter}</span>
                                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="mt-3 flex min-h-[1.1rem] items-center justify-center">
                                    {status === 'error' ? (
                                        <p className="flex items-center gap-1 text-[11px] font-semibold text-red-300">
                                            <AlertCircle className="h-3.5 w-3.5" /> {t.invalid}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] tracking-wide text-white/30">{t.helper}</p>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
