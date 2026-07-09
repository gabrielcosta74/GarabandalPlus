import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { renderMarketingTemplateEmail } from '../lib/email-renderer';
import { verifySvixSignature } from '../app/api/webhooks/resend/route';
import { getMarketingSendWindow, isWithinMarketingSendWindow } from '../lib/marketing-limits';

describe('marketing UTM attribution', () => {
  it('adds utm params with the template key to site links', () => {
    const { html } = renderMarketingTemplateEmail({
      templateKey: 'member_invitation',
      name: 'Maria Silva',
      language: 'pt',
    });
    expect(html).toContain('utm_source=email');
    expect(html).toContain('utm_medium=marketing');
    expect(html).toContain('utm_campaign=member_invitation');
  });

  it('keeps unsubscribe links clean', () => {
    const { html } = renderMarketingTemplateEmail({
      templateKey: 'member_invitation',
      name: 'Maria Silva',
      language: 'pt',
      unsubscribeUrl: 'https://apostoladodegarabandal.com/cancelar-subscricao?e=x&t=y',
    });
    const unsubscribeHref = html.match(/href="([^"]*cancelar-subscricao[^"]*)"/)?.[1];
    expect(unsubscribeHref).toBeTruthy();
    expect(unsubscribeHref).not.toContain('utm_');
  });

  it('does not tag external links (WhatsApp)', () => {
    const { html } = renderMarketingTemplateEmail({
      templateKey: 'waitlist_more_spots',
      name: 'Maria Silva',
      language: 'pt',
    });
    const waLinks = [...html.matchAll(/href="(https:\/\/wa\.me[^"]*)"/g)].map((m) => m[1]);
    expect(waLinks.length).toBeGreaterThan(0);
    for (const link of waLinks) expect(link).not.toContain('utm_');
  });
});

describe('membership_renewal copy matches expired segment', () => {
  it('PT speaks of an already-expired membership, without countdown urgency', () => {
    const { subject, html } = renderMarketingTemplateEmail({
      templateKey: 'membership_renewal',
      name: 'Maria Silva',
      language: 'pt',
    });
    expect(subject).not.toMatch(/faltam poucos dias/i);
    expect(html).toContain('venceu');
    expect(html).not.toContain('prestes a vencer');
  });

  it('EN speaks of an already-expired membership', () => {
    const { subject, html } = renderMarketingTemplateEmail({
      templateKey: 'membership_renewal',
      name: 'Mary Smith',
      language: 'en',
    });
    expect(subject).not.toMatch(/few days left/i);
    expect(html).toContain('has expired');
    expect(html).not.toContain('about to expire');
  });
});

describe('waitlist_open_spot states the real number of places', () => {
  it('PT subject and body carry the explicit count', () => {
    const { subject, html } = renderMarketingTemplateEmail({
      templateKey: 'waitlist_open_spot',
      name: 'Maria Silva',
      language: 'pt',
      pilgrimageName: 'Peregrinação a Garabandal - Novembro 2026',
      pilgrimageUrl: 'https://apostoladodegarabandal.com/peregrinacoes/nov',
      pilgrimageVacancies: 5,
    });
    expect(subject).toContain('restam apenas 5 vagas na peregrinação');
    expect(html).toContain('restam apenas 5 vagas');
    expect(html).toContain('5 vagas restantes');
  });

  it('uses singular for 1 place and a safe fallback without a count', () => {
    const one = renderMarketingTemplateEmail({
      templateKey: 'waitlist_open_spot',
      name: 'Maria',
      language: 'pt',
      pilgrimageVacancies: 1,
    });
    expect(one.subject).toContain('resta apenas 1 vaga');
    const none = renderMarketingTemplateEmail({
      templateKey: 'waitlist_open_spot',
      name: 'Maria',
      language: 'pt',
    });
    expect(none.subject).toContain('há vagas abertas');
  });

  it('EN subject carries the explicit count', () => {
    const { subject } = renderMarketingTemplateEmail({
      templateKey: 'waitlist_open_spot',
      name: 'Mary Smith',
      language: 'en',
      pilgrimageVacancies: 5,
    });
    expect(subject).toContain('there are only 5 places left on the pilgrimage');
  });
});

describe('marketing quiet hours (São Paulo window)', () => {
  it('defaults to 9-21', () => {
    delete process.env.MARKETING_SEND_WINDOW;
    expect(getMarketingSendWindow()).toEqual({ start: 9, end: 21 });
  });

  it('allows mid-afternoon and blocks the middle of the night in São Paulo', () => {
    delete process.env.MARKETING_SEND_WINDOW;
    // 18:00 UTC = 15:00 em São Paulo (UTC-3) → dentro da janela
    expect(isWithinMarketingSendWindow(new Date('2026-07-09T18:00:00Z'))).toBe(true);
    // 06:00 UTC = 03:00 em São Paulo → fora da janela
    expect(isWithinMarketingSendWindow(new Date('2026-07-09T06:00:00Z'))).toBe(false);
    // 23:30 UTC = 20:30 em São Paulo → ainda dentro (fim é exclusivo às 21)
    expect(isWithinMarketingSendWindow(new Date('2026-07-09T23:30:00Z'))).toBe(true);
    // 00:30 UTC = 21:30 em São Paulo → fora
    expect(isWithinMarketingSendWindow(new Date('2026-07-10T00:30:00Z'))).toBe(false);
  });

  it('honours MARKETING_SEND_WINDOW env override', () => {
    process.env.MARKETING_SEND_WINDOW = '10-20';
    expect(getMarketingSendWindow()).toEqual({ start: 10, end: 20 });
    delete process.env.MARKETING_SEND_WINDOW;
  });
});

describe('resend webhook signature (svix format)', () => {
  // Segredo sintético gerado aqui mesmo — nunca commitar valores com formato
  // whsec_<base64> literais (dispara o secret scanning do GitHub).
  const secret = ['whsec', Buffer.from('local-test-only-signing-key-1234').toString('base64')].join('_');
  const id = 'msg_p5jXN8AQM9LWM0D4loKWxJek';
  const timestamp = '1614265330';
  const payload = '{"test": 2432232314}';
  const sign = () => {
    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    return createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
  };

  it('accepts a valid v1 signature', () => {
    expect(verifySvixSignature(secret, id, timestamp, payload, `v1,${sign()}`)).toBe(true);
  });

  it('accepts when a valid signature is one of several space-separated entries', () => {
    expect(verifySvixSignature(secret, id, timestamp, payload, `v1,AAAA v1,${sign()}`)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    expect(verifySvixSignature(secret, id, timestamp, '{"test": 1}', `v1,${sign()}`)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    expect(verifySvixSignature('whsec_' + Buffer.from('other-secret-key-32bytes-long!!').toString('base64'), id, timestamp, payload, `v1,${sign()}`)).toBe(false);
  });
});
