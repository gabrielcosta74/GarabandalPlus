'use client';

import { useEffect, useState } from 'react';

export type InvitePreview = {
  creatorName: string | null;
  days: number | null;
  goingCount: number;
  kind: 'challenge' | 'session';
  startsAt: string;
  title: string;
};

const APP_STORE = 'https://apps.apple.com/app/id6806348119';
const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=com.apostoladodegarabandal.membros';
const PACKAGE = 'com.apostoladodegarabandal.membros';
const SCHEME = 'garabandalmembros';

const copy = {
  pt: {
    invited: (name: string) => `${name} convidou você para rezar juntos`,
    invitedNoName: 'Convite para rezar juntos',
    going: (count: number) => (count === 1 ? '1 pessoa vai rezar' : `${count} pessoas vão rezar`),
    days: (days: number) => `${days} dias seguidos`,
    open: 'Abrir no app',
    noApp: 'Ainda não tem o app Garabandal+?',
    install: 'Instale, crie a sua conta e volte a esta página para tocar em “Abrir no app”.',
    code: 'Código do convite',
    copyCode: 'Copiar código',
    copied: 'Copiado',
    manual: 'Também pode abrir o app em Comunidade › Rezar juntos › Tenho um código.',
    ended: 'Este convite já terminou ou não existe.',
    endedHint: 'Peça um novo convite a quem o enviou.',
  },
  en: {
    invited: (name: string) => `${name} invited you to pray together`,
    invitedNoName: 'Invitation to pray together',
    going: (count: number) => (count === 1 ? '1 person is going to pray' : `${count} people are going to pray`),
    days: (days: number) => `${days} days in a row`,
    open: 'Open in the app',
    noApp: 'Don’t have the Garabandal+ app yet?',
    install: 'Install it, create your account and come back to this page to tap “Open in the app”.',
    code: 'Invitation code',
    copyCode: 'Copy code',
    copied: 'Copied',
    manual: 'You can also open the app at Community › Pray together › I have a code.',
    ended: 'This invitation has ended or does not exist.',
    endedHint: 'Ask whoever sent it for a new invitation.',
  },
};

export default function RezarInvite({ code, english, preview }: {
  code: string | null;
  english: boolean;
  preview: InvitePreview | null | 'unknown';
}) {
  const text = english ? copy.en : copy.pt;
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [when, setWhen] = useState<string | null>(null);
  const [noAppHint, setNoAppHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const details = preview && preview !== 'unknown' ? preview : null;

  // A hora mostra-se no fuso de quem abre o link, por isso só no navegador.
  useEffect(() => {
    const agent = navigator.userAgent;
    setPlatform(/android/i.test(agent) ? 'android' : /iphone|ipad|ipod/i.test(agent) ? 'ios' : 'other');
    if (!details) return;
    if (details.kind === 'challenge' && details.days) {
      setWhen(text.days(details.days));
      return;
    }
    setWhen(new Intl.DateTimeFormat(english ? 'en' : 'pt-BR', {
      day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'long', weekday: 'long',
    }).format(new Date(details.startsAt)));
  }, [details, english, text]);

  if (!code || preview === null) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-5 py-16 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-slate-200 p-8 text-center">
          <h1 className="text-2xl font-serif text-slate-900 mb-3">{text.ended}</h1>
          <p className="text-slate-600 text-lg">{text.endedHint}</p>
        </div>
      </main>
    );
  }

  const path = `community/together?code=${encodeURIComponent(code)}`;
  const openApp = () => {
    // Android: abre o app, ou a Play Store se não estiver instalado.
    // iPhone: abre o app; se nada acontecer, mostra-se como o instalar.
    if (platform === 'android') {
      window.location.href = `intent://${path}#Intent;scheme=${SCHEME};package=${PACKAGE};S.browser_fallback_url=${encodeURIComponent(GOOGLE_PLAY)};end`;
      return;
    }
    window.location.href = `${SCHEME}://${path}`;
    window.setTimeout(() => { if (document.visibilityState === 'visible') setNoAppHint(true); }, 1600);
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem acesso à área de transferência, o código continua à vista.
    }
  };

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-5 py-12 bg-slate-50">
      <div className="max-w-md w-full space-y-5">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-7 text-center">
          <p className="text-slate-500 text-base mb-2">
            {details?.creatorName ? text.invited(details.creatorName) : text.invitedNoName}
          </p>
          {details ? (
            <>
              <h1 className="text-3xl font-serif text-slate-900 leading-tight mb-3">{details.title}</h1>
              {when ? <p className="text-blue-700 text-lg font-semibold mb-1 first-letter:uppercase">{when}</p> : null}
              <p className="text-slate-500">{text.going(details.goingCount)}</p>
            </>
          ) : null}
          <button
            className="mt-7 w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-4"
            onClick={openApp}
            type="button"
          >
            {text.open}
          </button>
        </div>

        <div className={`bg-white rounded-3xl border p-7 ${noAppHint ? 'border-blue-500 shadow-md' : 'border-slate-200 shadow-sm'}`}>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">{text.noApp}</h2>
          <p className="text-slate-600 mb-5">{text.install}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a className="rounded-2xl bg-slate-900 text-white text-center font-semibold py-3.5" href={APP_STORE}>App Store (iPhone)</a>
            <a className="rounded-2xl bg-slate-900 text-white text-center font-semibold py-3.5" href={GOOGLE_PLAY}>Google Play (Android)</a>
          </div>
          <div className="mt-6 rounded-2xl bg-slate-100 p-4 text-center">
            <p className="text-slate-500 text-sm mb-1">{text.code}</p>
            <p className="font-mono text-3xl tracking-[0.25em] text-slate-900 select-all">{code}</p>
            <button className="mt-3 text-blue-700 font-semibold" onClick={() => void copyCode()} type="button">
              {copied ? text.copied : text.copyCode}
            </button>
          </div>
          <p className="text-slate-500 text-sm mt-4">{text.manual}</p>
        </div>
      </div>
    </main>
  );
}
