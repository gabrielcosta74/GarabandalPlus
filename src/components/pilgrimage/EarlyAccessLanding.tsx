import Image from 'next/image';
import Link from 'next/link';
import EarlyAccessSignupForm from './EarlyAccessSignupForm';
import EarlyAccessDestinations from './EarlyAccessDestinations';
import EarlyAccessPricing from './EarlyAccessPricing';
import EarlyAccessMission from './EarlyAccessMission';
import { getEarlyAccessCopy, type EarlyAccessLocale } from './early-access-copy';
import styles from '../../app/acesso-antecipado/early-access.module.css';

export default function EarlyAccessLanding({
  locale = 'pt',
}: {
  locale?: EarlyAccessLocale;
}) {
  const copy = getEarlyAccessCopy(locale);
  const h = copy.hero;
  const sg = copy.signup;

  return (
    <>
      {/* ─── HERO (full viewport) ─── */}
      <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-5 text-center">
        {/* Background */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <Image
            src="/images/early-access-nossa-senhora.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_24%] opacity-90"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,0.28)_0%,rgba(8,8,8,0.45)_30%,rgba(8,8,8,0.65)_60%,rgba(8,8,8,0.92)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(8,8,8,0.2)_76%)]" />
        </div>

        <div className="relative z-10 w-full max-w-[34rem]">
          <p className="text-[13px] font-semibold uppercase tracking-[0.32em] text-[#d4bc7d]">
            {h.eyebrow}
          </p>

          <h1 className="mt-5 whitespace-nowrap [font-family:var(--font-early-script)] text-[clamp(2.4rem,10vw,4.2rem)] leading-none text-[#f8f1dd]">
            <span className={styles.scriptLine}>{h.title}</span>
          </h1>

          <p className="mx-auto mt-7 max-w-[22rem] text-[17px] leading-7 text-white/55">
            {h.lead.map((seg, i) =>
              seg.strong ? (
                <span key={i} className="font-medium text-white">
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </p>

          {/* Date badges */}
          <div className="mx-auto mt-10 flex items-start justify-center gap-10">
            <div className="text-center">
              <p className="[font-family:var(--font-early-serif)] text-[2rem] font-medium leading-none text-[#f0cc70]">
                {h.dateAccessValue}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#e0c37b]/70">
                {h.dateAccessLabel}
              </p>
            </div>
            <div className="mt-1.5 text-xl text-white/20">·</div>
            <div className="text-center">
              <p className="[font-family:var(--font-early-serif)] text-[2rem] font-medium leading-none text-white/50">
                {h.datePublicValue}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/30">
                {h.datePublicLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className={`absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3 ${styles.scrollHint}`}>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/50">
            {h.scrollHint}
          </p>
          <svg
            width="20"
            height="28"
            viewBox="0 0 20 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white/35"
          >
            <rect x="1" y="1" width="18" height="26" rx="9" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="10" cy="8" r="1.8" fill="currentColor" className={styles.scrollDot} />
          </svg>
        </div>
      </section>

      {/* ─── DESTINATIONS SHOWCASE ─── */}
      <EarlyAccessDestinations locale={locale} />

      {/* ─── PRICING ─── */}
      <EarlyAccessPricing locale={locale} />

      {/* ─── MISSION / CASA DO APOSTOLADO ─── */}
      <EarlyAccessMission locale={locale} />

      {/* ─── SIGNUP FORM ─── */}
      <section className="relative px-5 pb-12 pt-20 text-center sm:px-7 sm:pb-16 sm:pt-28">
        <div className="mx-auto w-full max-w-[31rem]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#d4bc7d]">
            {sg.eyebrow}
          </p>
          <p className="mx-auto mt-4 [font-family:var(--font-early-serif)] text-[clamp(1.6rem,6vw,2.6rem)] font-medium leading-snug text-[#f4f1e9]">
            {sg.title}
          </p>

          <div className="mx-auto mt-7 flex items-start justify-center gap-8 border-y border-white/10 py-5">
            <div className="text-center">
              <p className="[font-family:var(--font-early-serif)] text-xl font-medium leading-none text-[#f0cc70]">
                {h.dateAccessValue}
              </p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-[#e0c37b]/70">
                {sg.dateAccessLabel}
              </p>
            </div>
            <div className="mt-0.5 text-white/20">·</div>
            <div className="text-center">
              <p className="[font-family:var(--font-early-serif)] text-xl font-medium leading-none text-white/50">
                {h.datePublicValue}
              </p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">
                {sg.datePublicLabel}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <EarlyAccessSignupForm locale={locale} />
          </div>
        </div>
      </section>

      <footer className="pb-8 text-center text-[10px] text-white/30">
        <Link href={copy.paths.privacy} className="transition-colors hover:text-white/60">
          {copy.footerPrivacy}
        </Link>
      </footer>
    </>
  );
}
