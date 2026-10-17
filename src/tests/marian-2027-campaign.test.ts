import { describe, expect, it } from 'vitest';
import { selectMarian2027Audience, MARIAN_2027_STEPS, marian2027EmailContext } from '../lib/marian-2027-campaign';
import { renderMarketingTemplateEmail } from '../lib/email-renderer';

describe('Caminho Mariano 2027 campaign', () => {
  it('keeps only explicit Portuguese opt-ins and excludes bookings and unsubscribes', () => {
    const subscribers = [
      { normalized_email: ' MARIA@example.com ', display_name: 'Maria', language: 'pt', consent_state: 'explicit', external_status: 'active' },
      { normalized_email: 'maria@example.com', display_name: 'Duplicado', language: 'pt', consent_state: 'explicit', external_status: 'active' },
      { normalized_email: 'booked@example.com', display_name: 'Inscrita', language: 'pt', consent_state: 'explicit', external_status: 'active' },
      { normalized_email: 'optout@example.com', display_name: 'Sem emails', language: 'pt', consent_state: 'explicit', external_status: 'active' },
      { normalized_email: 'assumed@example.com', display_name: 'Sem prova', language: 'pt', consent_state: 'assumed', external_status: 'active' },
      { normalized_email: 'en@example.com', display_name: 'English', language: 'en', consent_state: 'explicit', external_status: 'active' },
      { normalized_email: 'bounced@example.com', display_name: 'Bounce', language: 'pt', consent_state: 'explicit', external_status: 'bounced' },
    ];
    const audience = selectMarian2027Audience(subscribers, new Set(['booked@example.com', 'optout@example.com']));
    expect(audience.map((contact) => contact.normalized_email)).toEqual(['maria@example.com']);
    expect(selectMarian2027Audience(subscribers, new Set(), 'en').map((contact) => contact.normalized_email)).toEqual(['en@example.com']);
  });

  it('renders three distinct emails in Portuguese and English with the correct pilgrimage link', () => {
    for (const language of ['pt', 'en'] as const) for (const step of MARIAN_2027_STEPS) {
      const rendered = renderMarketingTemplateEmail({
        templateKey: step.key,
        name: 'Maria',
        language,
        ...marian2027EmailContext(step.key),
        unsubscribeUrl: language === 'en' ? 'https://apostoladodegarabandal.com/en/unsubscribe?e=x&t=y' : 'https://apostoladodegarabandal.com/cancelar-subscricao?e=x&t=y',
      });
      expect(rendered.html).toContain(language === 'en' ? '/en/pilgrimages/peregrinacao-mariana-2027' : '/peregrinacoes/peregrinacao-mariana-2027');
      expect(rendered.html).toContain(language === 'en' ? '11–24 October 2027' : '11 a 24 de outubro de 2027');
      expect(rendered.html).toContain(step.image);
      expect(rendered.html).toMatch(/href="https?:\/\/[^\"]+\/(?:en\/pilgrimages|peregrinacoes)\/peregrinacao-mariana-2027[^\"]*" target="_blank" rel="noopener noreferrer"/);
      expect(rendered.html).toContain(language === 'en' ? 'unsubscribe' : 'cancelar a subscrição');
      expect(rendered.html).not.toMatch(/restam apenas \d+ vagas/i);
      expect(rendered.html).not.toContain('#d4af37');
    }
  });
});
