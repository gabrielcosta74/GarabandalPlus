'use client';

import Link from 'next/link';
import { Youtube, Instagram, Mail } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { CATEGORIES, PUBLIC_NAV_ORDER, type CategoryKey } from '../../lib/cms/categories';

export default function SiteFooter() {
  const { t, locale } = useLocale();

  // Server-rendered internal links to the content hubs. The primary nav builds
  // these client-side (via /api/nav/highlights), so they were absent from the
  // SSR HTML and Googlebot could not discover the category/article tree. These
  // crawlable <Link>s give every page a path into the whole content IA.
  const localePrefix = locale === 'en' ? '/en' : '';
  const aboutHref = locale === 'en' ? '/en/our-apostolate' : '/apostolado-garabandal';
  const aboutLabel = locale === 'en' ? 'About the Apostolate' : 'Sobre o Apostolado';
  const contentLinks = [
    { href: aboutHref, label: aboutLabel },
    ...[...PUBLIC_NAV_ORDER, 'noticias' as CategoryKey].map((key) => {
      const cat = CATEGORIES[key][locale === 'en' ? 'en' : 'pt'];
      return { href: `${localePrefix}/${cat.slug}`, label: cat.label };
    }),
    { href: `${localePrefix}/l`, label: locale === 'en' ? 'Articles' : 'Artigos' },
  ];

  return (
    <footer className="bg-[#050911] pt-20 pb-10 border-t border-white/5 relative z-10">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-serif text-2xl text-white mb-6">Apostolado de Garabandal</h4>
            <p className="text-white/50 font-light max-w-sm">
              {t.footer.description}
            </p>
          </div>

          <div>
            <h5 className="text-white font-medium uppercase tracking-widest text-sm mb-6">{locale === 'en' ? 'Content' : 'Conteúdo'}</h5>
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
