/**
 * Helpers for the pilgrimage rich-text fields.
 *
 * These fields historically stored plain text (with literal newlines) and now
 * store HTML produced by the inline TipTap editor. Both shapes must keep
 * working: legacy rows stay plain text until an admin edits and re-saves them.
 */

const HTML_TAG_RE = /<\/?(p|br|ul|ol|li|strong|b|em|i|u|s|h[1-6]|blockquote|a|mark)\b[^>]*>/i;

/** Heuristic: does this string already contain block/inline HTML we authored? */
export function looksLikeHtml(value: string | null | undefined): boolean {
  if (!value) return false;
  return HTML_TAG_RE.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convert legacy plain text into safe HTML paragraphs so it can be edited /
 * rendered consistently with newly-authored HTML. Blank lines split paragraphs;
 * single newlines become <br>.
 */
export function plainTextToHtml(value: string | null | undefined): string {
  if (!value || !value.trim()) return '';
  return value
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Normalise any stored value into HTML suitable for a rich-text context. */
export function toRichHtml(value: string | null | undefined): string {
  if (!value) return '';
  return looksLikeHtml(value) ? value : plainTextToHtml(value);
}

/** Strip HTML to a plain-text string (for teasers, cards, meta descriptions). */
export function richTextToPlain(value: string | null | undefined): string {
  if (!value) return '';
  const source = looksLikeHtml(value) ? value : value;
  return source
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the value has no visible content (covers TipTap's empty "<p></p>"). */
export function isRichTextEmpty(value: string | null | undefined): boolean {
  if (!value) return true;
  const stripped = value
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, '')
    .trim();
  return stripped.length === 0;
}
