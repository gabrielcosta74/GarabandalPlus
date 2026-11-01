import { CONTAINER, Eyebrow } from './ui';
import AppScreensSlider from './AppScreensSlider';
import StoreBadge from '../promo/StoreBadge';
import QRCode from 'qrcode';
import { appShortLink, buildAppLinks } from '../../lib/app-links';

export default async function AppDownloadBand({ locale }: { locale: 'pt' | 'en' }) {
  const isEn = locale === 'en';
  // Generic (region-less) links: the page is statically cached, and each store
  // redirects to the visitor's own storefront.
  const links = buildAppLinks({ locale, source: 'home_band' });
  const qr = await QRCode.toString(appShortLink(locale, 'home_qr'), {
    type: 'svg',
    margin: 1,
    color: { dark: '#0F1B33', light: '#FFFFFF' },
  });
  const linkClass =
    'font-semibold text-white underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

  const screens = [
    { src: '/images/app/screen-complete.webp', alt: isEn ? 'Garabandal+: your complete Catholic app' : 'Garabandal+: a sua app católica completa' },
    { src: '/images/app/screen-prayers.webp', alt: isEn ? 'Garabandal+: a prayer for every moment' : 'Garabandal+: uma oração para cada momento' },
    { src: '/images/app/screen-rosary.webp', alt: isEn ? 'Garabandal+: pray the rosary with meditations' : 'Garabandal+: contemple cada mistério do terço' },
    { src: '/images/app/screen-liturgy.webp', alt: isEn ? 'Garabandal+: the readings and Gospel of the day' : 'Garabandal+: as leituras e o Evangelho do dia' },
    { src: '/images/app/screen-confession.webp', alt: isEn ? 'Garabandal+: prepare your confession' : 'Garabandal+: prepare a sua confissão' },
    { src: '/images/app/screen-catechism.webp', alt: isEn ? 'Garabandal+: ask the Catechism' : 'Garabandal+: pergunte ao Catecismo' },
    { src: '/images/app/screen-community.webp', alt: isEn ? 'Garabandal+: pray in community' : 'Garabandal+: reze em comunidade' },
  ];

  return (
    <section
      aria-labelledby="home-app-heading"
      className="relative isolate overflow-hidden bg-ink py-20 text-white md:py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_45%_at_70%_70%,rgba(53,99,233,0.28),transparent_70%),radial-gradient(40%_30%_at_10%_0%,rgba(53,99,233,0.14),transparent_70%)]"
      />
      <div className={CONTAINER}>
        <div className="mb-12 flex flex-col gap-8 md:mb-16 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Eyebrow onDark>{isEn ? 'The Apostolate app' : 'A app do Apostolado'}</Eyebrow>
            <h2
              id="home-app-heading"
              className="text-[clamp(3rem,2rem+5vw,5.5rem)] font-semibold leading-none tracking-[-0.045em]"
            >
              Garabandal<span className="text-[#7DA8FF]">+</span>
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/75">
              {isEn
                ? 'Prayers, novenas, the daily liturgy and a community of prayer, always close to you.'
                : 'Orações, novenas, a liturgia do dia e uma comunidade de oração, sempre por perto.'}
            </p>
          </div>

          {/* Phones and tablets (no mouse): straight to the store. */}
          <div className="flex flex-col gap-3 sm:flex-row desktop-mouse:hidden">
            <StoreBadge store="app-store" href={links.appStore} locale={locale} />
            <StoreBadge store="google-play" href={links.googlePlay} locale={locale} variant="outline" />
          </div>

          {/* Desktop: a QR code carries the /app short link to the phone. */}
          <div className="hidden desktop-mouse:block">
            <div className="flex items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.05] p-4 pr-7">
              <div
                role="img"
                aria-label={isEn ? 'QR code to download the Garabandal+ app' : 'QR code para descarregar a app Garabandal+'}
                className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <div>
                <p className="text-lg font-semibold tracking-[-0.02em]">{isEn ? 'Open on your phone' : 'Abra no telemóvel'}</p>
                <p className="mt-1 max-w-[12rem] text-sm leading-relaxed text-white/65">
                  {isEn ? 'Point your camera to download the app.' : 'Aponte a câmara para descarregar a app.'}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/55">
              {isEn ? 'Or open the' : 'Ou abra a'}{' '}
              <a href={links.appStore} target="_blank" rel="noopener noreferrer" className={linkClass}>App Store</a>{' '}
              {isEn ? 'or' : 'ou o'}{' '}
              <a href={links.googlePlay} target="_blank" rel="noopener noreferrer" className={linkClass}>Google Play</a>
            </p>
          </div>
        </div>

        <AppScreensSlider
          screens={screens}
          labels={{
            previous: isEn ? 'Previous screens' : 'Ecrãs anteriores',
            next: isEn ? 'Next screens' : 'Ecrãs seguintes',
            goTo: isEn ? 'Go to screen {n}' : 'Ir para o ecrã {n}',
          }}
        />
      </div>
    </section>
  );
}
