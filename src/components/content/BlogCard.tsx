import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import type { PostRow } from '../../lib/content/queries';

const LOCALE_TO_DATE_LOCALE: Record<string, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
};

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(LOCALE_TO_DATE_LOCALE[locale] ?? 'pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function readingMinutes(html: string | null): number {
  if (!html) return 1;
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function BlogCard({ post, locale }: { post: PostRow; locale: 'pt' | 'en' | 'es' | 'fr' | 'it' }) {
  const href = (locale === 'pt' ? '' : `/${locale}`) + `/l/${post.slug}`;
  const date = formatDate(post.published_at ?? post.created_at, locale);
  const minutes = readingMinutes(post.content_html);
  const cover = post.cover_image_url ?? post.og_image_url ?? null;

  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: 'none',
        border: '1px solid var(--color-line, #e2e7f0)',
        textDecoration: 'none',
        color: 'inherit',
        height: '100%',
        position: 'relative',
      }}
      className="blog-card group hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-all duration-300 ease-out"
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 10',
          background: '#f1f5f9',
          overflow: 'hidden',
        }}
      >
        {cover ? (
          <Image
            src={cover}
            alt={post.title}
            fill
            sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
            className="transition-transform duration-700 ease-out group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, var(--color-garabandal-dark, #0f172a), #334155)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-brand-200, #c3d3fb)',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '4rem',
              fontWeight: 600,
            }}
          >
            G
          </div>
        )}
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(15,23,42,0.3) 0%, transparent 40%)',
            opacity: 0,
            transition: 'opacity 0.3s ease',
          }}
          className="group-hover:opacity-100"
        />
      </div>
      
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--muted)',
            marginBottom: '1rem',
            textTransform: 'none',
            letterSpacing: '0',
          }}
        >
          {date && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-muted, #5b6475)' }}>
              <Calendar size={14} aria-hidden /> {date}
            </span>
          )}
          {minutes > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={14} aria-hidden /> {minutes} min
            </span>
          )}
        </div>
        
        <h3
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '1.25rem',
            lineHeight: 1.35,
            fontWeight: 600,
            margin: '0 0 0.75rem',
            color: 'var(--color-garabandal-dark, #0f172a)',
            transition: 'color 0.2s ease',
          }}
          className="group-hover:text-brand-700"
        >
          {post.title}
        </h3>
        
        {post.meta_description ? (
          <p
            style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: 'var(--muted)',
              margin: '0 0 1.5rem 0',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flex: 1,
            }}
          >
            {post.meta_description}
          </p>
        ) : <div style={{ flex: 1 }} />}

        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            color: 'var(--color-garabandal-dark, #0f172a)',
            marginTop: 'auto',
          }}
        >
          <span className="transition-colors duration-300 group-hover:text-brand-700">Ler artigo</span>
          <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1 group-hover:text-brand-700" />
        </div>
      </div>
    </Link>
  );
}
