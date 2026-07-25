import { sanitizeAndValidate } from '../../lib/cms/sanitize';
import { toRichHtml, isRichTextEmpty } from '../../lib/rich-text';
import './rich-text.css';

interface RichTextProps {
  /** Stored field value: HTML (new) or plain text with newlines (legacy). */
  value: string | null | undefined;
  /** Caller controls base font-size / color / spacing context. */
  className?: string;
}

/**
 * Renders a pilgrimage rich-text field on the public site.
 * - Legacy plain-text values are converted to paragraphs (newlines preserved).
 * - HTML values are sanitized before injection.
 * Returns null when empty so callers can gate on it.
 */
export default function RichText({ value, className = '' }: RichTextProps) {
  if (isRichTextEmpty(value)) return null;
  const html = sanitizeAndValidate(toRichHtml(value));
  return (
    <div
      className={`pilgrimage-rich ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
