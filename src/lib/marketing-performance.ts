// Desempenho dos envios de marketing: agrega os logs de envio (alimentados pelo
// webhook do Resend) e junta as visitas atribuídas por UTM (site_sessions), para
// responder "este email funcionou?" por template.

export type PerformanceLog = {
  template_key: string | null;
  status: string;
  created_at: string;
  metadata?: Record<string, any> | null;
};

export type PerformanceSession = { utm_campaign: string | null; visitor_id: string };

export type TemplatePerformance = {
  template_key: string;
  sent: number;
  delivered: number;
  bounced: number;
  transient_bounces: number;
  complained: number;
  clicked: number;
  clicks: number;
  opened: number;
  visits: number;
  visitors: number;
  bookings: number;
  last_sent_at: string | null;
  delivery_rate: number | null;
  bounce_rate: number | null;
  click_rate: number | null;
};

export type PerformanceHealth = {
  sent: number;
  bounce_rate: number | null;
  complaint_rate: number | null;
  alerts: Array<{ severity: 'aviso' | 'critico'; message: string }>;
};

const ratio = (part: number, total: number) => (total > 0 ? part / total : null);

// Limiares habituais dos grandes fornecedores (Gmail/Yahoo olham para queixas
// de spam acima de 0,1% e bounces acima de ~2%).
export const BOUNCE_WARN = 0.02;
export const BOUNCE_CRITICAL = 0.04;
export const COMPLAINT_WARN = 0.001;

export function aggregateMarketingPerformance(
  logs: PerformanceLog[],
  sessions: PerformanceSession[] = [],
  bookedVisitorIds: Set<string> = new Set(),
): { templates: TemplatePerformance[]; health: PerformanceHealth } {
  const byTemplate = new Map<string, TemplatePerformance>();
  const row = (key: string): TemplatePerformance => {
    let item = byTemplate.get(key);
    if (!item) {
      item = {
        template_key: key,
        sent: 0, delivered: 0, bounced: 0, transient_bounces: 0, complained: 0,
        clicked: 0, clicks: 0, opened: 0, visits: 0, visitors: 0, bookings: 0,
        last_sent_at: null, delivery_rate: null, bounce_rate: null, click_rate: null,
      };
      byTemplate.set(key, item);
    }
    return item;
  };

  for (const log of logs) {
    if (log.status !== 'sent') continue;
    const item = row(log.template_key || 'sem_template');
    const meta = log.metadata || {};
    item.sent += 1;
    if (meta.delivered_at) item.delivered += 1;
    if (meta.bounced_at) {
      item.bounced += 1;
      if (meta.bounce_type === 'Transient') item.transient_bounces += 1;
    }
    if (meta.complained_at) item.complained += 1;
    if (meta.clicked_at) item.clicked += 1;
    item.clicks += Number(meta.click_count || 0);
    if (meta.opened_at) item.opened += 1;
    if (!item.last_sent_at || log.created_at > item.last_sent_at) item.last_sent_at = log.created_at;
  }

  const visitorsByTemplate = new Map<string, Set<string>>();
  for (const session of sessions) {
    const key = session.utm_campaign;
    if (!key) continue;
    const item = row(key);
    item.visits += 1;
    const set = visitorsByTemplate.get(key) || new Set<string>();
    set.add(session.visitor_id);
    visitorsByTemplate.set(key, set);
  }
  for (const [key, visitors] of visitorsByTemplate) {
    const item = row(key);
    item.visitors = visitors.size;
    item.bookings = Array.from(visitors).filter((id) => bookedVisitorIds.has(id)).length;
  }

  const templates = Array.from(byTemplate.values()).map((item) => ({
    ...item,
    // As taxas usam "entregues" quando o webhook as registou; senão os enviados.
    delivery_rate: ratio(item.delivered, item.sent),
    bounce_rate: ratio(item.bounced, item.sent),
    click_rate: ratio(item.clicked, item.delivered || item.sent),
  }));
  templates.sort((a, b) => (b.last_sent_at || '').localeCompare(a.last_sent_at || ''));

  const sent = templates.reduce((sum, t) => sum + t.sent, 0);
  const bounced = templates.reduce((sum, t) => sum + t.bounced, 0);
  const complained = templates.reduce((sum, t) => sum + t.complained, 0);
  const bounceRate = ratio(bounced, sent);
  const complaintRate = ratio(complained, sent);

  const alerts: PerformanceHealth['alerts'] = [];
  if (bounceRate !== null && bounceRate >= BOUNCE_CRITICAL) {
    alerts.push({ severity: 'critico', message: `Taxa de bounce de ${(bounceRate * 100).toFixed(1)}% — acima de 4%, a reputação do domínio está em risco.` });
  } else if (bounceRate !== null && bounceRate >= BOUNCE_WARN) {
    alerts.push({ severity: 'aviso', message: `Taxa de bounce de ${(bounceRate * 100).toFixed(1)}% — acima de 2%; limpar moradas inválidas.` });
  }
  if (complaintRate !== null && complaintRate >= COMPLAINT_WARN) {
    alerts.push({ severity: 'critico', message: `Queixas de spam em ${(complaintRate * 100).toFixed(2)}% dos envios — acima do limiar de 0,1%.` });
  }
  for (const t of templates) {
    if (t.sent >= 50 && t.bounce_rate !== null && t.bounce_rate >= BOUNCE_CRITICAL) {
      alerts.push({ severity: 'aviso', message: `${t.template_key}: ${(t.bounce_rate * 100).toFixed(1)}% de bounces em ${t.sent} envios.` });
    }
  }

  return { templates, health: { sent, bounce_rate: bounceRate, complaint_rate: complaintRate, alerts } };
}
