"use client";

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronRight, Clock, Sparkles, X } from 'lucide-react';
import { getStoreBookPromoRemainingMs, isStoreBookPromoActive } from '../../lib/store-promo';
import { useLocale } from '../../contexts/LocaleContext';

const getRemainingParts = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    { key: 'hours', value: hours },
    { key: 'minutes', value: minutes },
    { key: 'seconds', value: seconds },
  ].map((part) => ({ ...part, display: String(part.value).padStart(2, '0') }));
};

export function StoreBookPromoCountdown({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  const isEn = locale === 'en';
  const [remainingMs, setRemainingMs] = useState(() => getStoreBookPromoRemainingMs());

  useEffect(() => {
    const interval = window.setInterval(() => setRemainingMs(getStoreBookPromoRemainingMs()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (remainingMs <= 0) return null;

  const parts = getRemainingParts(remainingMs);
  const labels = isEn
    ? { hours: 'HRS', minutes: 'MIN', seconds: 'SEC' }
    : { hours: 'H', minutes: 'MIN', seconds: 'SEG' };

  return (
    <div className={compact ? 'w-full' : 'w-full sm:w-auto'}>
      <div className={`mb-2 flex items-center gap-1.5 font-black uppercase text-garabandal-gold ${compact ? 'text-[11px]' : 'text-xs'}`}>
        <Clock className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        <span>{isEn ? 'Today only!' : 'Só hoje!'}</span>
      </div>
      <div className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {parts.map((part) => (
          <div
            key={part.key}
            className={`rounded-xl border border-white/15 bg-white text-center text-slate-950 shadow-lg shadow-slate-950/10 ${compact ? 'px-2 py-2' : 'min-w-[72px] px-3 py-2.5'}`}
          >
            <div className={`font-mono font-black leading-none tabular-nums ${compact ? 'text-xl' : 'text-3xl'}`}>{part.display}</div>
            <div className={`mt-1 font-black uppercase text-slate-500 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{labels[part.key as keyof typeof labels]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StoreBookPromoBanner({ onViewBooks }: { onViewBooks?: () => void }) {
  const { locale } = useLocale();
  const isEn = locale === 'en';

  if (!isStoreBookPromoActive()) return null;

  return (
    <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 text-white shadow-xl shadow-slate-950/10">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-garabandal-gold text-slate-950">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-garabandal-gold">
                {isEn ? 'Today only! First apparition day' : 'Só hoje! Dia da primeira aparição'}
              </p>
              <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">
                {isEn ? '15% off all Garabandal books' : '15% em todos os livros de Garabandal'}
              </h2>
              <p className="mt-1 text-sm text-white/65">
                {isEn ? 'Ends at midnight in Brazil. Prices return to normal after that.' : 'Termina à meia-noite no Brasil. Depois o preço volta ao normal.'}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[250px] sm:items-stretch">
            <StoreBookPromoCountdown />
            {onViewBooks && (
              <button
                type="button"
                onClick={onViewBooks}
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-garabandal-gold px-4 text-xs font-black uppercase tracking-wide text-slate-950 transition-transform active:scale-[0.98]"
              >
                {isEn ? 'Buy with 15%' : 'Comprar com 15%'}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function StoreBookPromoPopup({ onViewBooks }: { onViewBooks?: () => void }) {
  const { locale } = useLocale();
  const isEn = locale === 'en';
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isStoreBookPromoActive()) return;
    if (sessionStorage.getItem('store:book-promo-seen') === '1') return;

    const timer = window.setTimeout(() => setIsOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  const close = () => {
    sessionStorage.setItem('store:book-promo-seen', '1');
    setIsOpen(false);
  };

  const handleViewBooks = () => {
    onViewBooks?.();
    close();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[9998] bg-slate-950/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[9999] px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[390px] sm:p-0"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="bg-slate-950 p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 text-garabandal-gold">
                    <BookOpen className="h-5 w-5" />
                    <span className="text-[11px] font-black uppercase tracking-[0.18em]">{isEn ? 'Today only!' : 'Só hoje!'}</span>
                  </div>
                  <button type="button" onClick={close} className="-mr-2 -mt-2 rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white" aria-label={isEn ? 'Close' : 'Fechar'}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <h3 className="mt-4 text-4xl font-black leading-none">
                  {isEn ? '15% off' : '15% desconto'}
                </h3>
                <p className="mt-2 text-base font-bold text-white">
                  {isEn ? 'All Garabandal books, today only.' : 'Em todos os livros de Garabandal, só hoje!'}
                </p>
                <p className="mt-2 text-sm text-white/70">
                  {isEn ? 'Ends at midnight in Brazil.' : 'Termina à meia-noite no Brasil.'}
                </p>
              </div>

              <div className="space-y-3 p-4">
                <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white">
                  <StoreBookPromoCountdown compact />
                </div>
                <button
                  type="button"
                  onClick={handleViewBooks}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-garabandal-gold px-4 text-sm font-black text-slate-950 shadow-lg shadow-garabandal-gold/20 transition-transform active:scale-[0.98]"
                >
                  {isEn ? 'Buy before it ends' : 'Comprar antes que termine'}
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={close} className="h-11 w-full rounded-xl border border-slate-200 text-sm font-bold text-slate-600">
                  {isEn ? 'Not now' : 'Agora não'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
