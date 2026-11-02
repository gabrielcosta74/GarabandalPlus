import { describe, expect, it } from 'vitest';
import { isDeliverableMarketingEmail } from '../lib/marketing-core';
import { buildMarketingContacts } from '../lib/marketing-data';
import { processMarketingEnrollment } from '../lib/marketing-automation-engine';

describe('deliverable marketing addresses', () => {
  it('accepts normal addresses', () => {
    expect(isDeliverableMarketingEmail('Maria.Silva@gmail.com')).toBe(true);
    expect(isDeliverableMarketingEmail('joao@uol.com.br')).toBe(true);
  });

  it('rejects placeholders, reserved domains and known typos', () => {
    expect(isDeliverableMarketingEmail('visitante123@chat.local')).toBe(false);
    expect(isDeliverableMarketingEmail('x@sem-email.local')).toBe(false);
    expect(isDeliverableMarketingEmail('x@example.com')).toBe(false);
    expect(isDeliverableMarketingEmail('x@gamail.com')).toBe(false);
    expect(isDeliverableMarketingEmail('x@hotmail.clm')).toBe(false);
    expect(isDeliverableMarketingEmail('sem-arroba')).toBe(false);
    expect(isDeliverableMarketingEmail('x@dominio')).toBe(false);
  });
});

type Row = Record<string, any>;

// Cliente mínimo: cada tabela devolve as linhas dadas (com .order/.range encadeados).
const fakeSupabase = (tables: Record<string, Row[] | { error: string }>) => ({
  from: (table: string) => {
    const source = tables[table] ?? [];
    const chain: any = {
      select: () => chain,
      order: () => chain,
      range: (from: number, to: number) =>
        Promise.resolve(
          'error' in (source as any) && !Array.isArray(source)
            ? { data: null, error: { message: (source as any).error } }
            : { data: (source as Row[]).slice(from, to + 1), error: null },
        ),
    };
    return chain;
  },
});

describe('marketing source reads fail closed', () => {
  it('aborts instead of treating a failed suppression read as an empty list', async () => {
    const supabase = fakeSupabase({ marketing_suppression_list: { error: 'timeout' } });
    await expect(buildMarketingContacts(supabase as any)).rejects.toThrow(/marketing_suppression_list/);
  });

  it('only counts accounts with is_membro as members', async () => {
    const supabase = fakeSupabase({
      membros: [
        { id: 'a', nome: 'Pago', email: 'pago@gmail.com', is_membro: true, estado_quota: 'pago' },
        { id: 'b', nome: 'Pendente', email: 'pendente@gmail.com', is_membro: false, estado_quota: 'pendente' },
      ],
    });
    const contacts = await buildMarketingContacts(supabase as any);
    const byEmail = Object.fromEntries(contacts.map((c) => [c.normalized_email, c]));
    expect(byEmail['pago@gmail.com'].source_summary.is_member).toBe(true);
    expect(byEmail['pendente@gmail.com'].source_summary.is_member).toBe(false);
  });
});

describe('processMarketingEnrollment guards', () => {
  const makeEnrollment = (email: string, language = 'pt') => ({
    id: 'enr-1',
    current_step: 0,
    next_run_at: '2026-11-02T10:00:00+00:00',
    funnel: { id: 'f1', slug: 'member-onboarding', name: 'Onboarding', segment_slug: null, steps: [{ template_key: 'member_welcome', delay_hours: 0 }] },
    contact: { id: 'c1', normalized_email: email, language, consent_state: 'explicit', source_summary: {} },
  });

  const recordingSupabase = () => {
    const updates: Row[] = [];
    const supabase = {
      from: () => ({
        update: (values: Row) => {
          updates.push(values);
          const chain: any = { eq: () => chain, select: () => Promise.resolve({ data: [], error: null }) };
          return chain;
        },
        insert: () => Promise.resolve({ error: null }),
        // contagens de envios recentes (limites de frequência): nenhum envio
        select: () => {
          const chain: any = { eq: () => chain, gte: () => chain, then: (resolve: any) => resolve({ count: 0, error: null }) };
          return chain;
        },
      }),
    };
    return { supabase, updates };
  };

  it('stops enrollments pointing at undeliverable addresses without sending', async () => {
    const { supabase, updates } = recordingSupabase();
    const result = await processMarketingEnrollment(supabase, makeEnrollment('visitante@chat.local'));
    expect(result).toMatchObject({ status: 'stopped', reason: 'undeliverable_address' });
    expect(updates[0]).toMatchObject({ status: 'stopped', stopped_reason: 'undeliverable_address' });
  });

  it('pauses Spanish contacts, which have no copy yet', async () => {
    const { supabase } = recordingSupabase();
    const result = await processMarketingEnrollment(supabase, makeEnrollment('ana@gmail.com', 'es'));
    expect(result).toMatchObject({ status: 'paused', reason: 'language_unsupported' });
  });

  it('does not send when another run already claimed the step', async () => {
    const { supabase } = recordingSupabase();
    // O fake devolve 0 linhas no claim (select vazio) → outra corrida já o reservou.
    const result = await processMarketingEnrollment(supabase, makeEnrollment('ana@gmail.com'));
    expect(result).toMatchObject({ status: 'skipped', reason: 'already_claimed' });
  });
});
