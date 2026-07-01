import { describe, expect, it, vi } from 'vitest';
import {
  calculateMarketingScore,
  determineLifecycleStage,
  emptySourceSummary,
  evaluateMarketingSegments,
  getMarketingRecommendation,
  inferLanguage,
  normalizeCountry,
  normalizeEmail,
  normalizePhone,
  normalizeQuotaStatus,
} from '../lib/marketing-core';

describe('marketing normalization', () => {
  it('normalizes identity and legacy status values', () => {
    expect(normalizeEmail('  TEST@Example.COM ')).toBe('test@example.com');
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizePhone('(+351) 912 345 678')).toBe('+351912345678');
    expect(normalizeCountry('US')).toBe('Estados Unidos');
    expect(normalizeCountry('Brasil')).toBe('Brasil');
    expect(normalizeQuotaStatus("'pendente'")).toBe('pendente');
    expect(normalizeQuotaStatus('expired')).toBe('expirado');
  });

  it('infers marketing language from explicit locale and country', () => {
    expect(inferLanguage('Portugal')).toBe('pt');
    expect(inferLanguage('Brasil')).toBe('pt');
    expect(inferLanguage('United States')).toBe('en');
    expect(inferLanguage('Germany')).toBe('en');
    expect(inferLanguage('Portugal', 'en')).toBe('en');
  });
});

describe('marketing scoring and segmentation', () => {
  it('keeps waitlist contacts out of recovery segments', () => {
    vi.setSystemTime(new Date('2026-04-23T12:00:00Z'));
    const summary = emptySourceSummary();
    summary.brochure_requests = 1;
    summary.waitlists = 1;
    summary.leads = 1;

    const lead_score = calculateMarketingScore(summary, '2026-04-20T12:00:00Z');
    const lifecycle_stage = determineLifecycleStage(summary);
    const contact = { source_summary: summary, lead_score, lifecycle_stage };

    expect(lead_score).toBe(100);
    expect(lifecycle_stage).toBe('pilgrim_lead');
    const segments = evaluateMarketingSegments(contact);
    expect(segments).toEqual(expect.arrayContaining(['brochure-requested-not-booked', 'waitlist-contacts']));
    expect(segments).not.toContain('hot-pilgrimage-leads');
    expect(segments).not.toContain('abandoned-registration');
    expect(getMarketingRecommendation({ source_summary: summary, lead_score })).toBe('Announce next available pilgrimage');
    vi.useRealTimers();
  });

  it('identifies donors not members and expired members', () => {
    const donor = emptySourceSummary();
    donor.succeeded_donations = 1;
    donor.donation_value = 250;
    const donorScore = calculateMarketingScore(donor, '2026-04-22T12:00:00Z');
    expect(determineLifecycleStage(donor)).toBe('donor');
    expect(evaluateMarketingSegments({ source_summary: donor, lead_score: donorScore, lifecycle_stage: 'donor' })).toEqual(
      expect.arrayContaining(['donors-not-members', 'high-value-supporters']),
    );

    const member = emptySourceSummary();
    member.is_member = true;
    member.member_status = 'expirado';
    const memberScore = calculateMarketingScore(member, '2026-04-22T12:00:00Z');
    expect(determineLifecycleStage(member)).toBe('member');
    expect(evaluateMarketingSegments({ source_summary: member, lead_score: memberScore, lifecycle_stage: 'member' })).toEqual(
      expect.arrayContaining(['members-without-referrals', 'expired-pending-members']),
    );
  });
});
