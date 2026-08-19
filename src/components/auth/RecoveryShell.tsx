import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../../lib/chat-config';

type RecoveryShellProps = {
  children: ReactNode;
  locale: 'pt' | 'en';
  step: 1 | 2 | 3;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  showHelp?: boolean;
};

export default function RecoveryShell({
  children,
  locale,
  step,
  title,
  subtitle,
  align = 'left',
  showHelp = false,
}: RecoveryShellProps) {
  const isEn = locale === 'en';
  const loginPath = isEn ? '/en/login' : '/login';
  const privacyPath = isEn ? '/en/privacy' : '/privacidade';
  const helpMessage = isEn
    ? 'Hello, I need help recovering access to my account.'
    : 'Olá, preciso de ajuda para recuperar o acesso à minha conta.';
  const helpUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(helpMessage)}`;

  return (
    <main className="min-h-[100dvh] bg-white px-5 py-5 text-slate-950 sm:bg-[#f6f5f2] sm:px-6 sm:py-8 lg:flex lg:items-center">
      <div className="mx-auto w-full max-w-[480px]">
        <header className="mb-6 flex min-h-11 items-center justify-between gap-4 sm:mb-7">
          <div className="flex items-center gap-2.5" aria-label={isEn ? 'Garabandal Apostolate' : 'Apostolado de Garabandal'}>
            <Image
              src="/icon-192.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full"
              priority
            />
            <span className="text-sm font-extrabold tracking-tight text-slate-900">
              {isEn ? 'Garabandal Apostolate' : 'Apostolado'}
            </span>
          </div>

          <Link
            href={loginPath}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-slate-600 transition-colors hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {isEn ? 'Sign in' : 'Entrar'}
          </Link>
        </header>

        <section className="sm:rounded-[28px] sm:border sm:border-slate-200/80 sm:bg-white sm:p-8 sm:shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-6" aria-label={isEn ? `Step ${step} of 3` : `Passo ${step} de 3`}>
            <div className="mb-2 flex gap-2" aria-hidden="true">
              {[1, 2, 3].map((item) => (
                <span
                  key={item}
                  className={`h-1.5 flex-1 rounded-full ${item <= step ? 'bg-amber-500' : 'bg-slate-200'}`}
                />
              ))}
            </div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">
              {isEn ? `Step ${step} of 3` : `Passo ${step} de 3`}
            </p>
          </div>

          <div className={align === 'center' ? 'text-center' : 'text-left'}>
            <h1 className="text-[30px] font-black leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-[34px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 text-base leading-6 text-slate-600 sm:text-[17px]">
                {subtitle}
              </p>
            )}
          </div>

          <div className="mt-7">{children}</div>

          {showHelp && (
            <div className="mt-7 border-t border-slate-200 pt-5 text-center">
              <a
                href={helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-600 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {isEn ? 'Need help? Talk to us' : 'Precisa de ajuda? Fale connosco'}
              </a>
            </div>
          )}
        </section>

        <div className="mt-4 text-center">
          <Link
            href={privacyPath}
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-bold text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            {isEn ? 'Privacy policy' : 'Política de privacidade'}
          </Link>
        </div>
      </div>
    </main>
  );
}

export const recoveryInputClassName =
  'min-h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export const recoveryPrimaryButtonClassName =
  'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-base font-extrabold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none';

export const recoverySecondaryButtonClassName =
  'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-base font-extrabold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-400';
