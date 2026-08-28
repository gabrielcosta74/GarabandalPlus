import { afterEach, describe, expect, it, vi } from 'vitest';
import { isExpoPushToken, localHourFor, sendExpoPush } from '../lib/expo-push';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hora local de quem recebe', () => {
  /**
   * O teste que justifica o campo `timezone` existir.
   *
   * Sao 98 membros no Brasil e 65 em Portugal. As 13:00 UTC ja e tarde em
   * Lisboa e ainda e manha em Sao Paulo — se o servidor decidisse pela sua
   * propria hora, um dos dois grupos recebia sempre a hora errada.
   */
  it('da horas diferentes ao mesmo instante em fusos diferentes', () => {
    const instant = new Date('2026-08-26T13:00:00Z');

    expect(localHourFor('America/Sao_Paulo', instant)).toBe(10);
    expect(localHourFor('Europe/Lisbon', instant)).toBe(14);
    expect(localHourFor('UTC', instant)).toBe(13);
  });

  it('atravessa a meia-noite sem se enganar no dia', () => {
    // 01:00 UTC do dia 27 ainda e a noite do dia 26 em Sao Paulo.
    expect(localHourFor('America/Sao_Paulo', new Date('2026-08-27T01:00:00Z'))).toBe(22);
  });

  /**
   * Alguns ICU devolvem "24" para a meia-noite com `hour12: false`. Sem o modulo
   * isto devolvia 24, que nunca e igual a hora de envio — o membro nessa faixa
   * simplesmente nunca receberia nada, e em silencio.
   */
  it('trata a meia-noite como 0 e nunca como 24', () => {
    const hour = localHourFor('UTC', new Date('2026-08-26T00:30:00Z'));

    expect(hour).toBe(0);
    expect(hour).not.toBe(24);
  });

  it('devolve null em vez de adivinhar quando o fuso nao serve', () => {
    const instant = new Date('2026-08-26T13:00:00Z');

    expect(localHourFor('Nao/Existe', instant)).toBeNull();
    expect(localHourFor(null, instant)).toBeNull();
    expect(localHourFor(undefined, instant)).toBeNull();
    expect(localHourFor('', instant)).toBeNull();
  });
});

describe('formato do token do Expo', () => {
  it('aceita as duas formas validas e recusa o resto', () => {
    expect(isExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);

    expect(isExpoPushToken('nao e um token')).toBe(false);
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false);
    expect(isExpoPushToken(null)).toBe(false);
    expect(isExpoPushToken(undefined)).toBe(false);
    expect(isExpoPushToken('')).toBe(false);
  });
});

describe('envio para o Expo', () => {
  const token = (suffix: string) => `ExponentPushToken[${suffix.padEnd(22, 'x')}]`;

  it('conta os aceites e devolve os tokens mortos para serem apagados', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { status: 'ok' },
            { status: 'error', details: { error: 'DeviceNotRegistered' } },
            { status: 'ok' },
          ],
        }),
      })),
    );

    const result = await sendExpoPush([
      { to: token('a'), title: 't', body: 'b' },
      { to: token('b'), title: 't', body: 'b' },
      { to: token('c'), title: 't', body: 'b' },
    ]);

    expect(result.delivered).toBe(2);
    expect(result.failed).toBe(1);
    // O bilhete vem pela ordem das mensagens: tem de ser o SEGUNDO token.
    expect(result.invalidTokens).toEqual([token('b')]);
  });

  it('nao lanca quando o Expo esta em baixo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('rede');
    }));

    const result = await sendExpoPush([{ to: token('a'), title: 't', body: 'b' }]);

    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(1);
  });

  it('nao lanca quando o Expo responde com erro HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })));

    const result = await sendExpoPush([{ to: token('a'), title: 't', body: 'b' }]);

    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(1);
  });

  /**
   * Um token malformado nao pode gastar uma mensagem do lote nem ser enviado.
   * Conta como falha para as contagens fecharem.
   */
  it('filtra tokens invalidos antes de tocar na rede', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);

    const result = await sendExpoPush([{ to: 'lixo', title: 't', body: 'b' }]);

    expect(spy).not.toHaveBeenCalled();
    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(1);
  });

  /** Uma resposta mais curta do que o lote nao pode deixar mensagens por contar. */
  it('nao perde mensagens quando a resposta vem incompleta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ status: 'ok' }] }) })),
    );

    const result = await sendExpoPush([
      { to: token('a'), title: 't', body: 'b' },
      { to: token('b'), title: 't', body: 'b' },
    ]);

    expect(result.delivered + result.failed).toBe(2);
  });

  it('divide em lotes de 100, que e o maximo que o Expo aceita', async () => {
    const spy = vi.fn(async (_url: string, init: { body: string }) => ({
      ok: true,
      json: async () => ({
        data: (JSON.parse(init.body) as unknown[]).map(() => ({ status: 'ok' })),
      }),
    }));
    vi.stubGlobal('fetch', spy);

    const messages = Array.from({ length: 250 }, (_, index) => ({
      to: token(`t${index}`),
      title: 't',
      body: 'b',
    }));

    const result = await sendExpoPush(messages);

    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.delivered).toBe(250);
  });
});
