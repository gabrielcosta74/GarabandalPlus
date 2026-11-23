import { describe, expect, it } from 'vitest';
import { dailyCopy, firstCopy, firstName } from '../lib/intention-notifications';

describe('first prayer notification privacy', () => {
  it('never quotes the intention text on the lock screen', () => {
    expect(firstCopy('pt-BR', 'Ana Gomes')).toEqual({ title: 'Ana rezou por você', body: 'Pela intenção que você publicou.' });
    expect(firstCopy('en', 'Anna Smith')).toEqual({ title: 'Anna prayed for you', body: 'For the intention you shared.' });
  });

  it('falls back to "Alguém" without a usable name', () => {
    expect(firstCopy('pt-PT').title).toBe('Alguém rezou por você');
    expect(firstCopy('pt-BR', 'Maximilianoaugusto').title).toBe('Alguém rezou por você');
    expect(firstName('  ‮Ana‬  G.')).toBe('Ana');
  });
});

describe('daily prayer summary', () => {
  it('names a single person when the name may be shown', () => {
    expect(dailyCopy('pt-BR', 1, 'Ana Gomes')).toEqual({ title: 'Ana rezou por você', body: 'Pela sua intenção.' });
    expect(dailyCopy('pt-BR', 2, 'Ana Gomes').title).toBe('2 pessoas rezaram por você');
  });

  it('puts the count in a short title', () => {
    expect(dailyCopy('pt-BR', 3)).toEqual({ title: '3 pessoas rezaram por você', body: 'Pela sua intenção. Veja quem foi.' });
    expect(dailyCopy('pt-BR', 1).title).toBe('1 pessoa rezou por você');
    expect(dailyCopy('en', 2).title).toBe('2 people prayed for you');
  });
});
