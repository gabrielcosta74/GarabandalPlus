import { describe, expect, it, vi } from 'vitest';

import {
  FactPtClient,
  FactPtRateLimiter,
  type FactPtConfig,
} from '../lib/factpt';

function sandboxConfig(): FactPtConfig {
  return {
    environment: 'sandbox',
    baseUrl: 'http://api.sandbox.fact.pt',
    apiKey: 'secret-key',
    apiVersion: '1.0.0',
    timeoutMs: 1_000,
    series: '2026D',
    credentialSlot: 'D',
  };
}

function clientWithResponses(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  responses.forEach((response) => fetchMock.mockResolvedValueOnce(response));
  return {
    client: new FactPtClient(sandboxConfig(), {
      fetch: fetchMock,
      rateLimiter: new FactPtRateLimiter({ minimumIntervalMs: 0 }),
    }),
    fetchMock,
  };
}

const ok = (data: unknown) => new Response(JSON.stringify({
  AppStatusMsg: 'OK',
  AppResponse: { data },
}), { status: 200 });

describe('FACT.pt legacy final consumers', () => {
  it('reuses one profile without email when address identity matches', async () => {
    const legacy = {
      id: '5587336',
      name: 'Olimpia Margarida Paiva Lopes dos Santos',
      email: '',
      address: 'Travessa Lomas Valentinas 1649',
      zip: '66093-671',
      city: 'Belém - PA, 66093-671',
      country: 'BR',
      isFinalConsumer: true,
    };
    const { client, fetchMock } = clientWithResponses(ok([]), ok([legacy]));

    await expect(client.findOrCreateClient({
      name: 'Olimpia Margarida Paiva Lopes dos Santos',
      email: 'olimpia@example.test',
      address: 'Travessa Lomas Valentinas 1649, Bairro Marco, Belém, Pará',
      zip: '66093-671',
      city: 'Belém',
      country: 'br',
      finalConsumer: true,
    })).resolves.toEqual({
      client: legacy,
      created: false,
      updated: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never reuses a profile whose populated email differs', async () => {
    const conflicting = {
      id: 'legacy-1',
      name: 'Veronica De La Rosa Clark',
      email: 'another-person@example.test',
      address: '1617 Grappenhall Dr',
      zip: '27502',
      city: 'NC',
      country: 'US',
      isFinalConsumer: true,
    };
    const { client } = clientWithResponses(
      ok([]),
      ok([conflicting]),
      ok({ id: 'new-final' }),
    );

    await expect(client.findOrCreateClient({
      name: 'Veronica De La Rosa Clark',
      email: 'veronica@example.test',
      address: '1617 Grappenhall Dr',
      zip: '27502',
      city: 'Apex',
      country: 'US',
      finalConsumer: true,
    })).resolves.toMatchObject({
      client: { id: 'new-final' },
      created: true,
      updated: false,
    });
  });

  it('reconciles a duplicate name only through a strong legacy match', async () => {
    const legacy = {
      id: '5646387',
      name: 'Veronica De La Rosa Clark',
      email: '',
      address: '1617 Grappenhall Dr',
      zip: '27502',
      city: 'NC',
      country: 'US',
      isFinalConsumer: true,
    };
    const duplicate = new Response(JSON.stringify({
      HttpStatusCode: 422,
      AppStatusCode: 405,
      AppStatusMsg: 'ERR',
      AppResponse: {
        errors: { name: 'The final consumer name already exists.' },
      },
    }), { status: 422 });
    const { client } = clientWithResponses(
      ok([]),
      ok([]),
      duplicate,
      ok([legacy]),
    );

    await expect(client.findOrCreateClient({
      name: 'Veronica De La Rosa Clark',
      email: 'veronica@example.test',
      address: '1617 Grappenhall Dr',
      zip: '27502',
      city: 'Apex',
      country: 'US',
      finalConsumer: true,
    })).resolves.toEqual({
      client: legacy,
      created: false,
      updated: false,
    });
  });
});
