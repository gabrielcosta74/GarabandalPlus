import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Shared primitives for the homepage. Every section uses the same container,
 * vertical rhythm, header pattern, button set and card so the page reads as one
 * system. Colour rules: blue (`brand`) only marks the primary action, links and
 * focus; surfaces are white, paper or ink.
 */

export const CONTAINER = 'mx-auto w-full max-w-[1200px] px-5 sm:px-8 lg:px-10';

/** Branded fallback when an article has no cover/og image. */
export const FALLBACK_IMAGE = '/images/nossasenhoragarabandal.jpg';

type Tone = 'white' | 'paper' | 'ink';

const TONES: Record<Tone, string> = {
  white: 'bg-white text-ink',
  paper: 'bg-paper text-ink',
  ink: 'bg-ink text-white',
};

export function Section({
  tone = 'white',
  labelledBy,
  className = '',
  children,
}: {
  tone?: Tone;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={labelledBy} className={`${TONES[tone]} py-20 md:py-28 ${className}`}>
      <div className={CONTAINER}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <p className={`mb-4 text-xs font-semibold uppercase tracking-[0.14em] ${onDark ? 'text-white/65' : 'text-muted'}`}>
      {children}
    </p>
  );
}

export const H2_CLASS =
  'text-[clamp(1.875rem,1.3rem+2.3vw,3rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-balance';

export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  action,
  onDark = false,
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  action?: { href: string; label: string };
  onDark?: boolean;
}) {
  return (
    <div className="mb-12 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow>}
        <h2 id={id} className={H2_CLASS}>{title}</h2>
        {description && (
          <p className={`mt-5 text-lg leading-relaxed ${onDark ? 'text-white/75' : 'text-muted'}`}>{description}</p>
        )}
      </div>
      {action && <TextLink href={action.href} onDark={onDark}>{action.label}</TextLink>}
    </div>
  );
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

const BUTTONS = {
  primary: `bg-brand text-white hover:bg-brand-700 hover:shadow-[0_10px_28px_-10px_rgba(53,99,233,0.65)] ${FOCUS}`,
  secondary: `border border-ink/15 bg-transparent text-ink hover:border-ink hover:bg-ink hover:text-white ${FOCUS}`,
  // Over photography / ink surfaces.
  light: 'bg-white text-ink hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
  ghost: 'border border-white/30 bg-white/[0.04] text-white backdrop-blur-sm hover:border-white hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
} as const;

export function buttonClass(variant: keyof typeof BUTTONS = 'primary', extra = '') {
  return `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold tracking-[-0.01em] transition-all duration-300 ease-out ${BUTTONS[variant]} ${extra}`;
}

export function TextLink({
  href,
  children,
  onDark = false,
  external = false,
}: {
  href: string;
  children: ReactNode;
  onDark?: boolean;
  external?: boolean;
}) {
  const className = `group inline-flex shrink-0 items-center gap-2 text-sm font-semibold underline-offset-[6px] hover:underline ${
    onDark ? 'text-white focus-visible:outline-white' : 'text-ink'
  } ${FOCUS}`;
  const inner = (
    <>
      {children}
      <ArrowRight size={16} aria-hidden className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
  ) : (
    <Link href={href} className={className}>{inner}</Link>
  );
}

export function formatDate(iso: string | null, locale: 'pt' | 'en'): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Image-first card with no box: the picture carries the colour, the text sits on
 * the page background. The whole card is the link; hover only underlines the
 * title and eases the image.
 */
export function MediaCard({
  href,
  image,
  title,
  excerpt,
  meta,
  sizes,
  aspect = 'aspect-[3/2]',
  titleClass = 'text-xl',
  serifTitle = false,
  excerptLines = 'line-clamp-2',
}: {
  href: string;
  image: string | null;
  title: string;
  excerpt?: string | null;
  meta?: string | null;
  sizes: string;
  aspect?: string;
  titleClass?: string;
  /** Editorial content (articles) sets its titles in the serif. */
  serifTitle?: boolean;
  excerptLines?: string;
}) {
  return (
    <Link href={href} className={`group block rounded-xl ${FOCUS}`}>
      <div className={`relative ${aspect} overflow-hidden rounded-xl bg-line`}>
        <Image
          src={image || FALLBACK_IMAGE}
          alt=""
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-5">
        {meta && <p className="mb-2 text-sm text-muted">{meta}</p>}
        <h3 className={`line-clamp-3 ${serifTitle ? 'font-serif font-medium leading-snug' : 'font-semibold leading-snug tracking-[-0.015em]'} text-ink underline-offset-4 decoration-1 group-hover:underline ${titleClass}`}>
          {title}
        </h3>
        {excerpt && <p className={`mt-2 text-[15px] leading-relaxed text-muted ${excerptLines}`}>{excerpt}</p>}
      </div>
    </Link>
  );
}
