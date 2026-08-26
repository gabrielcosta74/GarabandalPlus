import type { Metadata } from 'next';
import Link from 'next/link';
import EarlyAccessConfirmation from '../../../components/pilgrimage/EarlyAccessConfirmation';

export const metadata: Metadata = {
  title: 'Acesso confirmado — Caminho Mariano 2027',
  robots: { index: false, follow: false },
};

export default function EarlyAccessConfirmedPage() {
  return (
    <>
      <EarlyAccessConfirmation />
      <footer className="text-center text-[10px] text-white/30">
        <Link href="/privacidade" className="transition-colors hover:text-white/60">Privacidade</Link>
      </footer>
    </>
  );
}
