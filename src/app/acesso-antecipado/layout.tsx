import Image from 'next/image';
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
    <main className={`${cormorant.variable} ${allura.variable} relative min-h-svh overflow-hidden bg-[#080808] text-[#f4f1e9]`}>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Image
          src="/images/early-access-nossa-senhora.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_24%] opacity-90"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,0.32)_0%,rgba(8,8,8,0.5)_34%,rgba(8,8,8,0.68)_65%,rgba(8,8,8,0.88)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(8,8,8,0.2)_76%)]" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[31rem] flex-col px-5 pb-7 pt-7 sm:px-7">
        {children}
      </div>
    </main>
  );
}
