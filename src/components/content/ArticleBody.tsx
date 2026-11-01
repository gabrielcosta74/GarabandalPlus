import './article-prose.css';
import { enhanceArticleHtml } from '../../lib/content/enhance-html';

/** Presentation only: the stored CMS HTML is preserved. */
export function ArticleBody({ html, variant = 'standard' }: {
  html: string | null | undefined;
  variant?: 'standard' | 'feature';
}) {
  if (!html) return null;
  const isFeature = variant === 'feature';
  const enhanced = enhanceArticleHtml(html, { curateFeatureImages: isFeature });
  return (
    <div className={`article-body${isFeature ? ' article-body--feature' : ''}`}>
      <article
        className={`article-prose${isFeature ? ' article-prose--feature' : ''}`}
        dangerouslySetInnerHTML={{ __html: enhanced }}
      />
    </div>
  );
}
