'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Youtube, Instagram, Mail } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { CATEGORIES, PUBLIC_NAV_ORDER, localePrefix as prefixFor, type CategoryKey } from '../../lib/cms/categories';
import { getPublicLocaleFromPathname } from '../../lib/locale-routing';

// `null` where that locale has no "about" page yet — FR and IT currently 404
// on /fr/apostolado-garabandal and /it/apostolado-garabandal, and a nav link to
// a 404 on every page is worse than no link at all. Add the slug here once the
// page exists.
const ABOUT_SLUG: Record<string, string | null> = {
  pt: 'apostolado-garabandal',
  en: 'our-apostolate',
  es: 'apostolado-garabandal',
  fr: null,
  it: null,
};

const ARTICLES_LABEL: Record<string, string> = {
  pt: 'Artigos', en: 'Articles', es: 'Artículos', fr: 'Articles', it: 'Articoli',
};

const ABOUT_LABEL: Record<string, string> = {
  pt: 'Sobre o Apostolado',
  en: 'About the Apostolate',
  es: 'Sobre el Apostolado',
  fr: 'À propos de l\'Apostolat',
  it: 'Sull\'Apostolato',
};

const CONTENT_HEADING: Record<string, string> = {
  pt: 'Conteúdo', en: 'Content', es: 'Contenido', fr: 'Contenu', it: 'Contenuto',
};

export default function SiteFooter() {
  const { t, locale } = useLocale();
  const pathname = usePathname();

  // Server-rendered internal links to the content hubs. The primary nav builds
  // these client-side (via /api/nav/highlights), so they were absent from the
  // SSR HTML and Googlebot could not discover the category/article tree. These
  // crawlable <Link>s give every page a path into the whole content IA.
  //
  // `locale` from the context is only ever 'pt' | 'en' (that is all the UI
  // translation bundles cover), so it used to send /es, /fr and /it visitors —
  // and Googlebot — into the Portuguese tree. Resolve the section from the URL
  // instead so each locale links within itself.
  const navLocale = getPublicLocaleFromPathname(pathname);
  const prefix = prefixFor(navLocale);
  const aboutSlug = ABOUT_SLUG[navLocale];
  const contentLinks = [
    ...(aboutSlug ? [{ href: `${prefix}/${aboutSlug}`, label: ABOUT_LABEL[navLocale] }] : []),
    ...[...PUBLIC_NAV_ORDER, 'noticias' as CategoryKey].map((key) => {
      const cat = CATEGORIES[key][navLocale];
      return { href: `${prefix}/${cat.slug}`, label: cat.label };
    }),
    { href: `${prefix}/l`, label: ARTICLES_LABEL[navLocale] },
  ];

  return (
    <footer className="bg-[#050911] pt-20 pb-10 border-t border-white/5 relative z-10">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            {/* h2, not h4: Lighthouse flagged the footer for skipping heading
                levels, and the heading order is how assistive tech (and Google)
                read the document outline. The visual size is unchanged. */}
            <h2 className="font-serif text-2xl text-white mb-6">Apostolado de Garabandal</h2>
            <p className="text-white/50 font-light max-w-sm">
              {t.footer.description}
            </p>
          </div>

          <div>
            <h5 className="text-white font-medium uppercase tracking-widest text-sm mb-6">{CONTENT_HEADING[navLocale]}</h5>
            <div className="flex flex-col space-y-4 text-white/50 text-sm font-light">
              {contentLinks.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-garabandal-gold transition-colors">{link.label}</Link>
              ))}
            </div>
          </div>

          <div>
            <h5 className="text-white font-medium uppercase tracking-widest text-sm mb-6">{t.footer.explore}</h5>
            <div className="flex flex-col space-y-4 text-white/50 text-sm font-light">
              <Link href={t.urls.becomeMember} className="hover:text-garabandal-gold transition-colors">{t.footer.becomeMember}</Link>
              <Link href={t.urls.donations} className="hover:text-garabandal-gold transition-colors">{t.footer.donations}</Link>
              <Link href={t.urls.store} className="hover:text-garabandal-gold transition-colors">{t.footer.onlineStore}</Link>
              <Link href={t.urls.login} className="hover:text-garabandal-gold transition-colors">{t.footer.account}</Link>
            </div>
          </div>

          <div>
            <h5 className="text-white font-medium uppercase tracking-widest text-sm mb-6">{t.footer.contact}</h5>
            <ul className="space-y-4 text-white/50 text-sm font-light">
              <li className="flex items-center">
                <Mail size={16} className="mr-3 text-garabandal-gold" />
                <span>geral@apostoladodegarabandal.com</span>
              </li>
            </ul>
            <div className="flex gap-4 mt-6">
              <a href="https://www.youtube.com/@apostoladodegarabandal" target="_blank" rel="noreferrer" aria-label="YouTube" className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-lg transition-all hover:-translate-y-1 hover:border-transparent hover:bg-[#ff0000] hover:shadow-[0_10px_30px_-6px_rgba(255,0,0,0.6)]">
                <Youtube size={22} strokeWidth={2.25} />
              </a>
              <a href="https://www.instagram.com/apostoladodegarabandaloficial/" target="_blank" rel="noreferrer" aria-label="Instagram" className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-lg transition-all hover:-translate-y-1 hover:border-transparent hover:bg-gradient-to-br hover:from-[#f58529] hover:via-[#dd2a7b] hover:to-[#8134af] hover:shadow-[0_10px_30px_-6px_rgba(221,42,123,0.6)]">
                <Instagram size={22} strokeWidth={2.25} />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-white/30 uppercase tracking-widest">
          <p>&copy; {new Date().getFullYear()} {t.footer.rights}</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mt-4 md:mt-0">
            <Link href={t.urls.privacy} className="hover:text-white transition-colors">{t.footer.privacy}</Link>
            <Link href={t.urls.terms} className="hover:text-white transition-colors">{t.footer.terms}</Link>
            <Link href={t.urls.cookies} className="hover:text-white transition-colors">{t.footer.cookies}</Link>
            <Link href={t.urls.returnPolicy} className="hover:text-white transition-colors">{t.footer.returnPolicy}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
