import Link from 'next/link';
import { Check, Globe } from 'lucide-react';
import type { ContentLocale, TranslationPeer } from '../../lib/content/queries';
import './locale-switcher.css';

const LABEL: Record<ContentLocale, string> = { pt: 'Português', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano' };
const SHORT: Record<ContentLocale, string> = { pt: 'PT', en: 'EN', es: 'ES', fr: 'FR', it: 'IT' };
const CAPTION: Record<ContentLocale, string> = { pt: 'Idioma do artigo', en: 'Article language', es: 'Idioma del artículo', fr: 'Langue de l’article', it: 'Lingua dell’articolo' };
const PAGE_CAPTION: Record<ContentLocale, string> = { pt: 'Idioma da página', en: 'Page language', es: 'Idioma de la página', fr: 'Langue de la page', it: 'Lingua della pagina' };
const ORDER: ContentLocale[] = ['pt', 'en', 'es', 'fr', 'it'];

/** Real translations only, in a stable order, with a clearly marked current language. */
export function LocaleSwitcher({ current, peers, basePath }: {
  current: ContentLocale;
  peers: TranslationPeer[];
  basePath: 'page' | 'post';
}) {
  const all = new Map(peers.map((peer) => [peer.locale, peer.slug]));
  if (!all.has(current)) all.set(current, '');
  if (all.size <= 1) return null;

  const caption = (basePath === 'post' ? CAPTION : PAGE_CAPTION)[current];

  return (
    <nav className="locsw" aria-label={caption}>
      <div className="locsw__label"><Globe size={18} aria-hidden /><span>{caption}</span></div>
      <ul className="locsw__list">
        {ORDER.filter((locale) => all.has(locale)).map((locale) => {
          const content = <><span className="locsw__full">{LABEL[locale]}</span><span className="locsw__short" aria-hidden>{SHORT[locale]}</span>{locale === current && <Check size={16} aria-hidden />}</>;
          const prefix = locale === 'pt' ? '' : `/${locale}`;
          const href = `${prefix}${basePath === 'post' ? '/l' : ''}/${all.get(locale)}`;
          return <li key={locale}>
            {locale === current ? (
              <span className="locsw__item locsw__item--current" aria-current="page" aria-label={LABEL[locale]} lang={locale}>{content}</span>
            ) : (
              <Link className="locsw__item" href={href} hrefLang={locale} lang={locale} aria-label={LABEL[locale]}>{content}</Link>
            )}
          </li>;
        })}
      </ul>
    </nav>
  );
}
