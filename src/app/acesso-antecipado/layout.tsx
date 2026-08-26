import { Allura, Cormorant_Garamond } from 'next/font/google';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-early-serif',
});

const allura = Allura({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-early-script',
});

export default function EarlyAccessLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={`${cormorant.variable} ${allura.variable} bg-[#080808] text-[#f4f1e9]`}>
      {children}
    </main>
  );
}
