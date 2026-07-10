import { cloneElement, isValidElement } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

type Crumb = { href?: string; label: string };

export function ArticleHero({
  title,
  subtitle,
  coverImage,
  breadcrumbs,
  meta,
  variant = 'page',
}: {
  title: string;
  subtitle?: string | null;
  coverImage?: string | null;
  breadcrumbs?: Crumb[];
  meta?: React.ReactNode;
  variant?: 'page' | 'post';
}) {
  // Hand the hero's light/dark theme down to themeable meta (e.g. the
  // LocaleSwitcher) so it stays legible on both photo and pale heroes.
  const tone: 'light' | 'dark' = coverImage ? 'dark' : 'light';
  const metaNode = isValidElement(meta)
    ? cloneElement(meta as React.ReactElement<{ tone?: 'light' | 'dark' }>, { tone })
    : meta;

  return (
    <header
      style={{
        position: 'relative',
        width: '100%',
        minHeight: coverImage ? 'min(70vh, 620px)' : 'auto',
        display: 'flex',
        alignItems: coverImage ? 'flex-end' : 'flex-start',
        padding: coverImage ? 'clamp(6rem, 15vw, 12rem) 1.5rem 4rem' : '6rem 1.5rem 4rem',
        overflow: 'hidden',
        background: coverImage ? '#0f172a' : 'linear-gradient(180deg, #f8faff 0%, #eef2f8 100%)',
      }}
    >
      {coverImage && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("${coverImage}")`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
              opacity: 0.6,
              filter: 'contrast(1.05) saturate(1.05)',
              transform: 'scale(1.02)',
              transition: 'transform 10s ease-out',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.4) 50%, rgba(15,23,42,0.1) 100%)',
            }}
          />
        </>
      )}

      <div
        style={{
          position: 'relative',
          maxWidth: 900,
          margin: '0 auto',
          width: '100%',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          animation: 'heroFadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {breadcrumbs?.length ? (
          <nav
            aria-label="breadcrumb"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              flexWrap: 'wrap',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: coverImage ? 'rgba(255,255,255,0.7)' : 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {breadcrumbs.map((c, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
                {c.href ? (
                  <Link
                    href={c.href}
                    style={{ color: 'inherit', transition: 'color 0.2s ease' }}
                    className={coverImage ? 'hover:text-white' : 'hover:text-[#0f172a]'}
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span style={{ color: coverImage ? '#fff' : 'var(--color-garabandal-dark)' }}>{c.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <ChevronRight size={14} aria-hidden />}
              </span>
            ))}
          </nav>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              padding: '0.4rem 1rem',
              borderRadius: 999,
              background: coverImage ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.1)',
              color: coverImage ? '#fbbf24' : '#b49010',
              border: `1px solid ${coverImage ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.2)'}`,
              backdropFilter: 'blur(8px)',
            }}
          >
            {variant === 'post' ? 'Artigo' : 'Página'}
          </span>
          {metaNode}
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: 0,
            color: coverImage ? '#fff' : 'var(--color-garabandal-dark)',
            textShadow: coverImage ? '0 4px 24px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          {title}
        </h1>

        {subtitle ? (
          <p
            style={{
              fontSize: 'clamp(1.1rem, 2vw, 1.35rem)',
              lineHeight: 1.6,
              color: coverImage ? 'rgba(255,255,255,0.85)' : 'var(--muted)',
              maxWidth: 760,
              margin: 0,
              fontWeight: 400,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </header>
  );
}
