import Image from 'next/image';
import QRCode from 'qrcode';
import { appShortLink, type AppLinks } from '../../lib/app-links';
import StoreBadge from './StoreBadge';

const COPY = {
  pt: {
    eyebrow: 'A app do Apostolado',
    lead: 'Orações, novenas, a liturgia do dia e uma comunidade de oração, sempre por perto.',
    scanTitle: 'Abra no telemóvel',
    scanBody: 'Aponte a câmara para descarregar a app.',
    scanAlt: 'QR code para descarregar a app Garabandal+',
    or: 'Ou escolha a sua loja',
  },
  en: {
    eyebrow: 'The Apostolate app',
    lead: 'Prayers, novenas, the daily liturgy and a community of prayer, always close to you.',
    scanTitle: 'Open on your phone',
    scanBody: 'Point your camera to download the app.',
    scanAlt: 'QR code to download the Garabandal+ app',
    or: 'Or pick your store',
  },
} as const;

/**
 * Landing page behind the short link /app. Phones are redirected to their store
 * before reaching it; desktops and crawlers land here, where the QR code carries
 * the same short link to the phone.
 */
export default async function AppLanding({ locale, links }: { locale: 'pt' | 'en'; links: AppLinks }) {
  const copy = COPY[locale];
  const qr = await QRCode.toString(appShortLink(locale, 'qr'), {
    type: 'svg',
    margin: 1,
    color: { dark: '#0F1B33', light: '#FFFFFF' },
  });

  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-[#0f1b33] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_75%_55%,rgba(53,99,233,0.30),transparent_70%),radial-gradient(40%_30%_at_5%_0%,rgba(53,99,233,0.14),transparent_70%)]"
      />
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-14 px-5 pb-24 pt-36 sm:px-8 lg:min-h-svh lg:grid-cols-[1fr_0.9fr] lg:gap-20 lg:px-10 lg:pt-28">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/65">{copy.eyebrow}</p>
          <h1 className="text-[clamp(3.25rem,2.2rem+5.5vw,6rem)] font-semibold leading-none tracking-[-0.045em]">
            Garabandal<span className="text-[#7DA8FF]">+</span>
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-white/75">{copy.lead}</p>

          <div className="mt-10 hidden items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:flex md:max-w-md">
            <div
              role="img"
              aria-label={copy.scanAlt}
              className="h-32 w-32 shrink-0 overflow-hidden rounded-2xl bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <div>
              <p className="text-lg font-semibold tracking-[-0.02em]">{copy.scanTitle}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/65">{copy.scanBody}</p>
            </div>
          </div>

          <p className="mb-4 mt-10 text-sm font-semibold uppercase tracking-[0.12em] text-white/55 md:mt-8">{copy.or}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <StoreBadge store="app-store" href={links.appStore} locale={locale} />
            <StoreBadge store="google-play" href={links.googlePlay} locale={locale} variant="outline" />
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-[460px] grid-cols-2 gap-4 sm:gap-5">
          {['complete', 'prayers'].map((name, i) => (
            <div key={name} className={`overflow-hidden rounded-[1.75rem] ring-1 ring-white/15 ${i === 1 ? 'mt-12' : ''}`}>
              <Image
                src={`/images/app/screen-${name}.webp`}
                alt=""
                width={853}
                height={1844}
                sizes="(max-width: 640px) 45vw, 230px"
                className="h-auto w-full"
                priority={i === 0}
              />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
