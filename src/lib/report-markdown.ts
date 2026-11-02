/** Usado no email do relatório semanal e no painel /admin/conversao. */

export const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Markdown mínimo (títulos, listas, negrito) → HTML, para email e painel. */
export function renderReportMarkdown(markdown: string) {
  const lines = escapeHtml(markdown).split('\n');
  const out: string[] = [];
  let inList = false;
  const inline = (text: string) => text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/_(.+?)_/g, '<em>$1</em>');
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
    if (bullet) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    if (!line) continue;
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) out.push(`<h${Math.min(4, heading[1].length + 1)}>${inline(heading[2])}</h${Math.min(4, heading[1].length + 1)}>`);
    else out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}
