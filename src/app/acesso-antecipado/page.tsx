import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import EarlyAccessSignupForm from '../../components/pilgrimage/EarlyAccessSignupForm';
import EarlyAccessDestinations from '../../components/pilgrimage/EarlyAccessDestinations';
import EarlyAccessPricing from '../../components/pilgrimage/EarlyAccessPricing';
import EarlyAccessMission from '../../components/pilgrimage/EarlyAccessMission';
import styles from './early-access.module.css';

export const metadata: Metadata = {
  title: 'Acesso antecipado — Caminho Mariano 2027',
  description: 'Acesso às inscrições do Caminho Mariano 2027 com 48 horas de antecedência.',
  alternates: { canonical: '/acesso-antecipado' },
};

export default function EarlyAccessPage() {
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
            Acesso VIP
          </p>

          <h1 className="mt-5 whitespace-nowrap [font-family:var(--font-early-script)] text-[clamp(2.4rem,10vw,4.2rem)] leading-none text-[#f8f1dd]">
            <span className={styles.scriptLine}>Caminho Mariano 2027</span>
          </h1>

          <p className="mx-auto mt-7 max-w-[22rem] text-[17px] leading-7 text-white/55">
            A lista privada recebe o acesso às inscrições
            a <span className="font-medium text-white">13 de outubro</span>.
          </p>

          {/* Date badges */}
          <div className="mx-auto mt-10 flex items-start justify-center gap-10">
            <div className="text-center">
              <p className="[font-family:var(--font-early-serif)] text-[2rem] font-medium leading-none text-[#f0cc70]">
                13 Out
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#e0c37b]/70">
                Acesso privado
              </p>
            </div>
            <div className="mt-1.5 text-xl text-white/20">·</div>
            <div className="text-center">
              <p className="[font-family:var(--font-early-serif)] text-[2rem] font-medium leading-none text-white/50">
                15 Out
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/30">
                Abertura pública
              </p>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className={`absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3 ${styles.scrollHint}`}>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/50">
            Descubra o percurso
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
      <EarlyAccessDestinations />

      {/* ─── PRICING ─── */}
      <EarlyAccessPricing />

      {/* ─── MISSION / CASA DO APOSTOLADO ─── */}
      <EarlyAccessMission />

      {/* ─── SIGNUP FORM ─── */}
      <section className="relative px-5 pb-12 pt-20 text-center sm:px-7 sm:pb-16 sm:pt-28">
        <div className="mx-auto w-full max-w-[31rem]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#d4bc7d]">
            Inscrição antecipada
          </p>
          <p className="mx-auto mt-4 [font-family:var(--font-early-serif)] text-[clamp(1.6rem,6vw,2.6rem)] font-medium leading-snug text-[#f4f1e9]">
            Garanta o seu lugar
          </p>

          <div className="mx-auto mt-7 flex items-start justify-center gap-8 border-y border-white/10 py-5">
            <div className="text-center">
              <p className="[font-family:var(--font-early-serif)] text-xl font-medium leading-none text-[#f0cc70]">
                13 Out
              </p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-[#e0c37b]/70">
                O seu acesso
              </p>
            </div>
            <div className="mt-0.5 text-white/20">·</div>
            <div className="text-center">
              <p className="[font-family:var(--font-early-serif)] text-xl font-medium leading-none text-white/50">
                15 Out
              </p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">
                Abertura pública
              </p>
            </div>
          </div>

          <div className="mt-8">
            <EarlyAccessSignupForm />
          </div>
        </div>
      </section>

      <footer className="pb-8 text-center text-[10px] text-white/30">
        <Link href="/privacidade" className="transition-colors hover:text-white/60">
          Privacidade
        </Link>
      </footer>
    </>
  );
}
