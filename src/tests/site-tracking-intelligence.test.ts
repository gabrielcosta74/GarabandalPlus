import { describe, expect, it } from 'vitest';
import { scorePerson, type SitePersonSignals } from '../lib/site-intent-score';
import { renderMarketingTemplateEmail } from '../lib/email-renderer';
import { renderReportMarkdown } from '../lib/report-markdown';

const NOW = new Date('2026-11-02T12:00:00Z').getTime();

const person = (overrides: Partial<SitePersonSignals> = {}): SitePersonSignals => ({
  email: 'maria@example.com',
  sessions: 1,
  page_views: 1,
  active_seconds: 30,
  read_itinerary: false,
  read_pricing: false,
  info_opens: 0,
  cta_clicks: 0,
  max_step: null,
  validation_errors: 0,
  chat_messages: 0,
  whatsapp_clicks: 0,
  last_seen: '2026-10-25T12:00:00Z',
  booking_id: null,
  booking_status: null,
  paid_amount: null,
  ...overrides,
});

describe('scorePerson', () => {
  it('a single short visit is cold', () => {
    const result = scorePerson(person(), NOW);
    expect(result.level).toBe('frio');
    expect(result.stage).toBe('em_aberto');
  });

  it('someone who came back, read everything and reached payment is hot', () => {
    const result = scorePerson(person({
      sessions: 3,
      active_seconds: 600,
      read_itinerary: true,
      read_pricing: true,
      info_opens: 1,
      cta_clicks: 1,
      max_step: 'pagamento',
      last_seen: '2026-11-01T20:00:00Z',
    }), NOW);
    expect(result.level).toBe('quente');
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.nextAction).toMatch(/pagamento/i);
    expect(result.reasons).toContain('Chegou ao passo do pagamento');
  });

  it('long inactivity lowers the score', () => {
    const recent = scorePerson(person({ sessions: 2, read_pricing: true, last_seen: '2026-11-01T12:00:00Z' }), NOW);
    const stale = scorePerson(person({ sessions: 2, read_pricing: true, last_seen: '2026-09-01T12:00:00Z' }), NOW);
    expect(stale.score).toBeLessThan(recent.score);
  });

  it('separates paid and unpaid bookings', () => {
    expect(scorePerson(person({ booking_id: 'b1', paid_amount: 500 }), NOW).stage).toBe('pagou');
    expect(scorePerson(person({ booking_id: 'b1', paid_amount: 0 }), NOW).stage).toBe('por_pagar');
  });
});

describe('abandoned registration step copy', () => {
  const render = (registrationStep?: 'dados' | 'quartos' | 'voos' | 'pagamento') => renderMarketingTemplateEmail({
    templateKey: 'abandoned_registration_1',
    name: 'Maria Silva',
    language: 'pt',
    pilgrimageName: 'Caminho Mariano 2027',
    registrationStep,
  }).html;

  it('keeps the current email when no step is passed', () => {
    const html = render();
    expect(html).toContain('Três passos rápidos');
    expect(html).not.toContain('Falta só o último passo');
  });

  it('adapts the first email to the step where the person stopped', () => {
    expect(render('pagamento')).toContain('Falta só o último passo');
    expect(render('pagamento')).toContain('prestações');
    expect(render('quartos')).toContain('Falta só escolher o quarto');
    expect(render('voos')).toContain('Dúvidas sobre os voos?');
    expect(render('dados')).toContain('Faltam só os seus dados');
  });
});

describe('renderReportMarkdown', () => {
  it('renders headings, lists and bold, and escapes html', () => {
    const html = renderReportMarkdown('## Resumo\n- **52%** chega ao preço\n- <script>x</script>');
    expect(html).toContain('<h3>Resumo</h3>');
    expect(html).toContain('<li><strong>52%</strong> chega ao preço</li>');
    expect(html).not.toContain('<script>');
  });
});

describe('abandoned registration segment', () => {
  it('does not treat a registered pilgrim as an abandoned registration', async () => {
    const { evaluateMarketingSegments, emptySourceSummary } = await import('../lib/marketing-core');
    const base = { lead_score: 80, lifecycle_stage: 'lead' as const, language: 'pt' as const };

    const abandoned = { ...emptySourceSummary(), leads: 1 };
    expect(evaluateMarketingSegments({ ...base, source_summary: abandoned })).toContain('abandoned-registration');

    // Inscrito com um email diferente do da conta: bookings = 0 mas há registo em pilgrims.
    const registered = { ...emptySourceSummary(), leads: 1, pilgrims: 1 };
    const segments = evaluateMarketingSegments({ ...base, source_summary: registered });
    expect(segments).not.toContain('abandoned-registration');
    expect(segments).not.toContain('hot-pilgrimage-leads');
    expect(segments).toContain('past-pilgrims');
  });

  it('stops the funnel once the person is a pilgrim', async () => {
    const { marketingContactReachedGoal, marketingStepConditionPasses } = await import('../lib/marketing-automation-engine');
    const contact = { source_summary: { leads: 1, bookings: 0, pilgrims: 1 } };
    expect(marketingContactReachedGoal(contact, ['booked_pilgrimage'])).toBe(true);
    expect(marketingStepConditionPasses(contact, 'not_booked')).toBe(false);
  });
});
