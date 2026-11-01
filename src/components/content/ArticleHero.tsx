import { type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ContentLocale } from '../../lib/content/queries';
import './article-layout.css';

type Crumb = { href?: string; label: string };

export function ArticleHero({ title, subtitle, coverImage, breadcrumbs, meta, languages, locale = 'pt', variant = 'page' }: {
  title: string;
  subtitle?: string | null;
  coverImage?: string | null;
  breadcrumbs?: Crumb[];
  meta?: ReactNode;
  languages?: ReactNode;
  variant?: 'page' | 'post';
  locale?: ContentLocale;
}) {
  const label = { pt: ['Artigo', 'Página'], en: ['Article', 'Page'], es: ['Artículo', 'Página'], fr: ['Article', 'Page'], it: ['Articolo', 'Pagina'] }[locale][variant === 'post' ? 0 : 1];
  const tone = coverImage ? 'dark' : 'light';
  const visibleCrumbs = breadcrumbs?.filter((crumb, index) => !(index > 0 && index === breadcrumbs.length - 1 && crumb.label === title));

  return (
    <header className="article-hero" data-article-hero-tone={tone}>
      {coverImage && <>
        <Image src={coverImage} alt={title} fill priority sizes="100vw" className="article-hero__image" />
        <div className="article-hero__shade" />
      </>}
      <div className="article-hero__inner">
        {visibleCrumbs?.length ? (
          <nav className="article-hero__breadcrumbs" aria-label="breadcrumb">
            {visibleCrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`}>
                {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
                {index < visibleCrumbs.length - 1 && <ChevronRight size={13} aria-hidden />}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="article-hero__category">
          <span className="article-hero__label">{label}</span>
        </div>
        <h1>{title}</h1>
        {subtitle ? <p className="article-hero__subtitle">{subtitle}</p> : null}
        {meta ? <div className="article-hero__meta">{meta}</div> : null}
        {languages ? <div className="article-hero__languages">{languages}</div> : null}
      </div>
    </header>
  );
}
