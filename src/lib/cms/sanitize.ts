import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitization for CMS-authored HTML before it's persisted to the DB.
 * The whitelist matches what TipTap will produce + what the migration extractor
 * produced. Anything else is stripped.
 *
 * IMPORTANT: We allow <iframe> ONLY for known video providers (YouTube, Vimeo,
 * SoundCloud, gloria.tv) — never arbitrary URLs.
 */

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote',
  'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'code',
  'a', 'img',
  'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'iframe',
  'div', 'span', // TipTap occasionally wraps; keep but strip dangerous attrs
];

const ALLOWED_ATTR = [
  // generic
  'href', 'title', 'rel', 'target', 'class',
  'src', 'alt', 'width', 'height',
  // iframe
  'allow', 'allowfullscreen', 'frameborder', 'loading',
  // tiptap markers we want to preserve
  'data-original',
  // text alignment
  'colspan', 'rowspan',
  // visual CMS block metadata. Values are validated again post-sanitize.
  'data-cms-block', 'data-variant', 'data-align', 'data-columns', 'data-ratio',
];

const ALLOWED_CLASS_RE = /^cms-(block|section|layout|columns|column|callout|quote|media|image|figure|figcaption|gallery|embed|divider|rule|todo|table|code|align|variant)(-[a-z0-9]+)*$/;

const ALLOWED_DATA_ATTR: Record<string, RegExp> = {
  'data-cms-block': /^(section|callout|quote|image|figure|gallery|video|columns|divider|table|code|todo|embed)$/,
  'data-variant': /^(info|success|warning|danger|default|gold|line|asterisks|wide|compact)$/,
  'data-align': /^(left|center|right|wide|full)$/,
  'data-columns': /^[2-4]$/,
  'data-ratio': /^(16-9|4-3|1-1|auto)$/,
};

const ALLOWED_IFRAME_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'vimeo.com',
  'w.soundcloud.com',
  'gloria.tv',
];

const ALLOWED_IMG_HOSTS_RE = /^https?:\/\/([^/]+\.)?(supabase\.co|clvaw-cdnwnd\.com)\//i;

/**
 * Strip dangerous content. Run on every server-side save BEFORE writing to DB.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Disallow ALL JS URI schemes
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_ATTR: ['style', 'id'],
    USE_PROFILES: { html: true },
    // Hook to validate iframe & img sources
    SAFE_FOR_TEMPLATES: false,
    ADD_ATTR: ['allowfullscreen'],
  });
}

function pruneCmsAttributes(html: string): string {
  let cleaned = html.replace(/\sclass="([^"]*)"/gi, (_full, classValue: string) => {
    const allowed = classValue
      .split(/\s+/)
      .filter((token) => ALLOWED_CLASS_RE.test(token));
    return allowed.length ? ` class="${allowed.join(' ')}"` : '';
  });

  cleaned = cleaned.replace(/\s(data-[a-z0-9-]+)="([^"]*)"/gi, (full, attr: string, value: string) => {
    const validator = ALLOWED_DATA_ATTR[attr.toLowerCase()];
    if (!validator) return '';
    return validator.test(value) ? full : '';
  });

  return cleaned;
}

/**
 * Post-process step: enforce iframe/img host whitelist that DOMPurify can't
 * easily express via config. Strips <iframe> from disallowed hosts and
 * blocks <img> from arbitrary external hosts.
 */
export function sanitizeAndValidate(html: string): string {
  let cleaned = pruneCmsAttributes(sanitizeHtml(html));

  // Strip iframes whose src host isn't whitelisted
  cleaned = cleaned.replace(/<iframe[^>]*src="([^"]+)"[^>]*><\/iframe>/gi, (full, src) => {
    try {
      const u = new URL(src, 'https://example.com');
      if (ALLOWED_IFRAME_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) {
        return full;
      }
    } catch { /* malformed URL */ }
    return '';
  });

  // Drop <img> with non-https / non-whitelisted hosts (keep relative /media/* and our domains)
  cleaned = cleaned.replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, (full, src) => {
    if (src.startsWith('/') || src.startsWith('data:image/')) return full;
    if (ALLOWED_IMG_HOSTS_RE.test(src)) return full;
    return '';
  });

  return cleaned;
}

/** Convert HTML body to a plain-text excerpt up to maxLen. */
export function buildExcerpt(html: string | null | undefined, maxLen = 240): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}
