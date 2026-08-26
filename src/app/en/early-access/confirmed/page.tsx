import type { Metadata } from 'next';
import Link from 'next/link';
import EarlyAccessConfirmation from '../../../../components/pilgrimage/EarlyAccessConfirmation';
import { getEarlyAccessCopy } from '../../../../components/pilgrimage/early-access-copy';

const copy = getEarlyAccessCopy('en');

export const metadata: Metadata = {
  title: 'Access confirmed — Marian Way 2027',
  robots: { index: false, follow: false },
};

export default function EarlyAccessConfirmedPage() {
  return (
    <>
      <EarlyAccessConfirmation locale="en" />
      <footer className="text-center text-[10px] text-white/30">
        <Link href={copy.paths.privacy} className="transition-colors hover:text-white/60">{copy.footerPrivacy}</Link>
      </footer>
    </>
  );
}
