import * as cheerio from 'cheerio';

/**
 * Presentation-only enhancement of migrated article/page HTML.
 *
 * Several migrated pages are "index / hub" pages: a long list of links to
 * sub-pages, each authored as a `<p>`/`<h3>` whose text is essentially a
 * single link, interleaved with decorative images of wildly different sizes.
 * Rendered as a plain article, this reads as a messy wall of bold links and
 * giant photos.
 *
 * When we detect that shape, we:
 *   - tag each "link-only" block with `cms-index-link` so the stylesheet can
 *     render it as a tidy, tappable directory row, and
 *   - wrap the whole body in `.cms-index` so images can be normalised to a
 *     consistent thumbnail size.
 *
 * This is intentionally *non-destructive*: every link, image, heading and its
 * alt text stays in the DOM in the same order, so SEO and the per-language CMS
 * content are untouched. We never bind a specific image to a specific link
 * (the authored order is ambiguous and images are reused) — we only restyle.
 *
 * Real article pages don't match the heuristic and pass through unchanged.
 */

const LINK_BLOCK_TAGS = new Set(['p', 'h3', 'h4']);

// \s already matches U+00A0 (non-breaking space), which is common in the
// migrated copy, so a single collapse is enough.
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export function enhanceArticleHtml(html?: string | null): string {
  if (!html) return html ?? '';

  try {
    const $ = cheerio.load(`<div id="__cms_root">${html}</div>`, null, false);
    const $root = $('#__cms_root');
    const children = $root.children().toArray();

    let linkItems = 0;

    for (const el of children) {
      const tag = (el as { tagName?: string }).tagName?.toLowerCase();
      if (!tag || !LINK_BLOCK_TAGS.has(tag)) continue;

      const $el = $(el);
      if (!$el.find('a[href]').attr('href')) continue;

      const text = norm($el.text());
      if (!text || text.length > 120) continue;

      // The block must be essentially just the link — not a prose paragraph
      // that happens to contain a link.
      const linkText = norm($el.find('a').text());
      if (linkText.length < text.length * 0.5) continue;

      $el.addClass('cms-index-link');
      linkItems++;
    }

    const total = children.length || 1;
    const isIndexPage = linkItems >= 6 && linkItems / total >= 0.3;
    if (!isIndexPage) return html;

    return `<div class="cms-index">${$root.html() ?? ''}</div>`;
  } catch {
    return html;
  }
}
