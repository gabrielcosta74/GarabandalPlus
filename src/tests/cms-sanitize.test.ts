import { describe, expect, it } from 'vitest';
import { sanitizeAndValidate } from '../lib/cms/sanitize';

describe('CMS media preservation', () => {
  it('keeps both existing film trailers and removes executable attributes', () => {
    const html = ['zVo2uTnVN5M', 'tHGfoGF4yuQ'].map((id) => `<iframe src="https://www.youtube.com/embed/${id}" onload="alert(1)" srcdoc="<script>alert(1)</script>"></iframe>`).join('');
    const clean = sanitizeAndValidate(html);
    expect(clean.match(/<iframe/g)).toHaveLength(2);
    expect(clean).toContain('https://www.youtube.com/embed/zVo2uTnVN5M');
    expect(clean).toContain('https://www.youtube.com/embed/tHGfoGF4yuQ');
    expect(clean).not.toMatch(/onload|srcdoc|<script/);
  });

  it.each([
    'https://example.com/embed/video',
    'https://www.youtube.com.evil.example/embed/video',
    'javascript:alert(1)',
    'http://www.youtube.com/embed/video',
    '/local-frame',
    '',
  ])('removes an unsupported iframe source: %s', (src) => {
    expect(sanitizeAndValidate(`<iframe src="${src}"></iframe>`)).not.toContain('<iframe');
  });

  it('preserves CMS blocks and formatted code while stripping unsafe markup', () => {
    const clean = sanitizeAndValidate('<div class="cms-callout arbitrary" data-cms-block="callout" data-variant="info" style="color:red"><p>Leia <strong>com atenção</strong>.</p></div><pre><code>exemplo</code></pre><script>alert(1)</script>');
    expect(clean).toContain('class="cms-callout"');
    expect(clean).toContain('data-variant="info"');
    expect(clean).toContain('<pre><code>exemplo</code></pre>');
    expect(clean).not.toMatch(/arbitrary|style=|<script/);
  });
});
