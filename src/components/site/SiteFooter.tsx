'use client';

import Link from 'next/link';
import { Facebook, Instagram, Mail } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

export default function SiteFooter() {
  const { t } = useLocale();

  return (
    <footer className="bg-[#050911] pt-20 pb-10 border-t border-white/5 relative z-10">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-serif text-2xl text-white mb-6">Apostolado de Garabandal</h4>
            <p className="text-white/50 font-light max-w-sm">
              {t.footer.description}
            </p>
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
            <div className="flex space-x-4 mt-6">
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-garabandal-gold hover:text-white transition-all">
                <Facebook size={18} />
              </a>
              <a href="https://www.instagram.com/apostoladodegarabandaloficial/" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-garabandal-gold hover:text-white transition-all">
                <Instagram size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-white/30 uppercase tracking-widest">
          <p>&copy; {new Date().getFullYear()} {t.footer.rights}</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link href={t.urls.privacy} className="hover:text-white transition-colors">{t.footer.privacy}</Link>
            <Link href={t.urls.terms} className="hover:text-white transition-colors">{t.footer.terms}</Link>
            <Link href={t.urls.cookies} className="hover:text-white transition-colors">{t.footer.cookies}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
