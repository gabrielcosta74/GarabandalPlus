import type { Metadata } from 'next';
import Link from 'next/link';
import EarlyAccessSignupForm from '../../components/pilgrimage/EarlyAccessSignupForm';
import styles from './early-access.module.css';

export const metadata: Metadata = {
  title: 'Acesso antecipado — Caminho Mariano 2027',
  description: 'Acesso às inscrições do Caminho Mariano 2027 com 48 horas de antecedência.',
  alternates: { canonical: '/acesso-antecipado' },
};

export default function EarlyAccessPage() {
  return (
    <>
      <div className="flex flex-1 flex-col justify-center py-10 text-center sm:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d4bc7d]">Acesso VIP</p>
        <h1 className="mt-4 [font-family:var(--font-early-script)] text-[clamp(1.9rem,8.5vw,3.4rem)] leading-none whitespace-nowrap text-[#f8f1dd]">
          <span className={styles.scriptLine}>Caminho Mariano 2027</span>
        </h1>
        <p className="mx-auto mt-5 max-w-[22rem] text-[15px] leading-6 text-white/65">
          A lista privada recebe o acesso às inscrições a <span className="text-white">13 de outubro</span>.
        </p>

        <div className="mt-6 border-y border-white/10 py-5">
          <div className="flex items-start justify-center gap-8">
            <div className="text-center">
              <p className="[font-family:var(--font-early-serif)] text-2xl font-medium leading-none text-[#f0cc70]">13 Out</p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-[#e0c37b]/70">Acesso privado</p>
            </div>
            <div className="mt-1 text-white/20 text-lg">·</div>
            <div className="text-center">
              <p className="[font-family:var(--font-early-serif)] text-2xl font-medium leading-none text-white/50">15 Out</p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">Abertura pública</p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <EarlyAccessSignupForm />
        </div>
      </div>

      <footer className="text-center text-[10px] text-white/30">
        <Link href="/privacidade" className="transition-colors hover:text-white/60">Privacidade</Link>
      </footer>
    </>
  );
}
