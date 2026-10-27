import type { MouseEventHandler } from 'react';

export function AppleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/** Google Play mark in its four brand colours. */
export function PlayMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 shrink-0">
      <path d="M4.2 2.3 13.4 12 4.2 21.7c-.4-.3-.6-.8-.6-1.4V3.7c0-.6.2-1.1.6-1.4Z" fill="#00D7FE" />
      <path d="M4.2 2.3c.4-.3 1-.3 1.6 0l11 6.3-3.4 3.4L4.2 2.3Z" fill="#00F076" />
      <path d="m4.2 21.7 9.2-9.7 3.4 3.4-11 6.3c-.6.3-1.2.3-1.6 0Z" fill="#FF3A44" />
      <path d="m16.8 8.6 3.4 2c.6.4.6 1.4 0 1.8l-3.4 2-3.4-3.4 3.4-2.4Z" fill="#FFCE00" />
    </svg>
  );
}

const SHELL =
  'inline-flex min-h-[3.75rem] items-center justify-center gap-3.5 rounded-full px-7 py-2.5 transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

/**
 * App Store / Google Play badge. Plain markup (no hooks) so it renders from
 * both server and client components; `onClick` is only for client callers.
 */
export default function StoreBadge({
  store,
  href,
  locale,
  ptBr = false,
  variant = 'solid',
  className = '',
  onClick,
}: {
  store: 'app-store' | 'google-play';
  href: string;
  locale: 'pt' | 'en';
  /** Brazilian wording ("Baixar" rather than "Descarregar"). */
  ptBr?: boolean;
  variant?: 'solid' | 'outline';
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const isEn = locale === 'en';
  const isApple = store === 'app-store';
  const name = isApple ? 'App Store' : 'Google Play';
  const download = ptBr ? 'Baixar' : 'Descarregar';
  const eyebrow = isApple
    ? (isEn ? 'Download on the' : `${download} na`)
    : (isEn ? 'Get it on' : 'Disponível no');
  const label = isApple
    ? (isEn ? 'Download Garabandal+ on the App Store' : `${download} Garabandal+ na App Store`)
    : (isEn ? 'Get Garabandal+ on Google Play' : `${download} Garabandal+ no Google Play`);

  const tone = variant === 'solid'
    ? 'bg-white text-[#0f1b33] hover:bg-white/85'
    : 'border border-white/30 bg-white/[0.04] text-white backdrop-blur-sm hover:border-white hover:bg-white/10';
  const eyebrowTone = variant === 'solid' ? 'text-[#0f1b33]/70' : 'text-white/70';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      onClick={onClick}
      className={`${SHELL} ${tone} ${className}`}
    >
      {isApple ? <AppleMark /> : <PlayMark />}
      <span className="flex flex-col items-start leading-tight">
        <span className={`text-[11px] font-medium ${eyebrowTone}`}>{eyebrow}</span>
        <strong className="text-[1.0625rem] font-semibold tracking-[-0.01em]">{name}</strong>
      </span>
    </a>
  );
}
