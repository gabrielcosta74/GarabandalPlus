'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Check, Copy, Share2 } from 'lucide-react';
import { getEarlyAccessCopy, type EarlyAccessLocale } from './early-access-copy';

const SUPPORT_WHATSAPP = 'https://wa.me/351915206815';
const STORAGE_KEY = 'early-access-confirmation';

type StoredConfirmation = {
  email: string;
  whatsappUrl: string | null;
  alreadyRegistered: boolean;
};

export default function EarlyAccessConfirmation({
  locale = 'pt',
}: {
  locale?: EarlyAccessLocale;
}) {
  const copy = getEarlyAccessCopy(locale);
  const c = copy.confirmation;
  const router = useRouter();

  function buildSupportUrl(email: string) {
    return `${SUPPORT_WHATSAPP}?text=${encodeURIComponent(c.supportMessage(email))}`;
  }
  const [data, setData] = useState<StoredConfirmation | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      setData(raw ? (JSON.parse(raw) as StoredConfirmation) : null);
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    if (data === null) {
      router.replace(copy.paths.landing);
    }
  }, [data, router, copy.paths.landing]);

  async function shareEarlyAccess() {
    const url = `${window.location.origin}${copy.paths.landing}`;
    const shareData = {
      title: c.shareTitle,
      text: c.shareText,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    } catch {
      // A pessoa pode cancelar a partilha nativa; não é um erro.
    }
  }

  if (!data) {
    return <div className="flex flex-1" aria-hidden="true" />;
  }

  const { email, whatsappUrl, alreadyRegistered } = data;

  return (
    <div className="flex flex-1 flex-col justify-center py-10 text-center animate-in fade-in zoom-in-95 duration-500 sm:py-16">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#bca56b]/55 text-[#e2c376]">
        <Check className="h-4 w-4" aria-hidden="true" />
      </div>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#bca56b]">
        {alreadyRegistered ? c.eyebrowRegistered : c.eyebrowDone}
      </p>
      <h1 className="mt-2 [font-family:var(--font-early-serif)] text-4xl font-medium leading-none text-[#f4f1e9] sm:text-5xl">
        {c.title}
      </h1>
      <p className="mx-auto mt-4 max-w-[22rem] text-sm leading-6 text-white/58">
        {c.lead}
      </p>

      <div className="mt-5 flex items-start justify-center gap-8 border-y border-white/10 py-5">
        <div className="text-center">
          <p className="[font-family:var(--font-early-serif)] text-2xl font-medium leading-none text-[#f0cc70]">{c.dateAccessValue}</p>
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-[#e0c37b]/70">{c.dateAccessLabel}</p>
        </div>
        <div className="mt-1 text-lg text-white/20">·</div>
        <div className="text-center">
          <p className="[font-family:var(--font-early-serif)] text-2xl font-medium leading-none text-white/50">{c.datePublicValue}</p>
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">{c.datePublicLabel}</p>
        </div>
      </div>

      <p className="mt-5 text-xs leading-5 text-white/40">
        {c.groupIntro}
      </p>

      <a
        href={whatsappUrl || buildSupportUrl(email)}
        target="_blank"
        rel="noreferrer"
        className="mt-8 inline-flex min-h-13 w-full items-center justify-between rounded-full bg-[#f4f1e9] px-5 py-3.5 text-sm font-semibold text-[#080808] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        <span className="flex items-center gap-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" className="h-4.5 w-4.5 text-[#25D366]" aria-hidden="true">
            <path d="M16.003 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.257.59 4.46 1.71 6.405L3.2 28.8l6.55-1.717a12.74 12.74 0 0 0 6.253 1.593h.005c7.06 0 12.8-5.74 12.8-12.8 0-3.42-1.332-6.635-3.752-9.055A12.715 12.715 0 0 0 16.003 3.2Zm0 23.36h-.004a10.57 10.57 0 0 1-5.385-1.475l-.386-.23-3.886 1.02 1.037-3.79-.252-.39a10.55 10.55 0 0 1-1.617-5.625c0-5.867 4.776-10.64 10.648-10.64a10.57 10.57 0 0 1 7.524 3.12 10.55 10.55 0 0 1 3.117 7.524c0 5.867-4.776 10.64-10.633 10.64Zm5.835-7.967c-.32-.16-1.892-.933-2.185-1.04-.293-.107-.507-.16-.72.16-.213.32-.826 1.04-1.013 1.253-.187.213-.373.24-.693.08-.32-.16-1.35-.498-2.572-1.587-.95-.847-1.592-1.893-1.779-2.213-.186-.32-.02-.493.14-.653.144-.143.32-.373.48-.56.16-.187.213-.32.32-.533.107-.213.053-.4-.027-.56-.08-.16-.72-1.733-.986-2.373-.26-.624-.524-.54-.72-.55l-.613-.01c-.213 0-.56.08-.853.4-.293.32-1.12 1.093-1.12 2.667 0 1.573 1.146 3.093 1.306 3.307.16.213 2.253 3.44 5.46 4.825.763.33 1.358.527 1.822.674.766.244 1.463.21 2.014.127.614-.092 1.892-.773 2.159-1.52.266-.747.266-1.387.186-1.52-.08-.133-.293-.213-.613-.373Z" />
          </svg>
          {whatsappUrl ? c.groupBtnActive : c.groupBtnRequest}
        </span>
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </a>

      <button
        type="button"
        onClick={shareEarlyAccess}
        className="mt-3 inline-flex min-h-12 w-full items-center justify-between rounded-full border border-white/18 bg-black/10 px-5 py-3 text-sm font-medium text-white/75 transition hover:border-white/35 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        <span>{copied ? c.inviteCopied : c.inviteBtn}</span>
        {copied ? <Copy className="h-4 w-4 text-[#d4bc7d]" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      </button>
      <p className="mt-4 text-[10px] leading-4 text-white/32">{c.inviteNote}</p>
    </div>
  );
}
