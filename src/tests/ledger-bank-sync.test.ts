import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), transactions: vi.fn(), balances: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('../lib/ledger/bank-live', () => ({ bankLiveConfigured: () => true }));
vi.mock('../lib/ledger/enable-banking', () => ({
  fetchTransactions: mocks.transactions,
  fetchBalances: mocks.balances,
  toStatementLine: (value: unknown) => value,
}));
vi.mock('../lib/ledger/server', () => ({
  db: () => ({ rpc: mocks.rpc }),
  getMontepioAccount: async () => ({ id: '11111111-1111-4111-8111-111111111111' }),
  loadCustomRules: async () => [],
}));

import { syncMontepio } from '../lib/ledger/bank-sync';

const line = {
  booked: true, bookingDate: '2026-11-04', valueDate: '2026-11-04', amount: 25,
  description: 'TR-IPS-Maria Costa', counterpartyName: 'Maria Costa',
  providerTxId: 'provider-1', balanceAfter: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENABLE_BANKING_ACCOUNT_UID = 'test-account';
  process.env.ENABLE_BANKING_SESSION_ID = 'test-session';
  mocks.transactions.mockResolvedValue([line]);
  mocks.balances.mockResolvedValue({ balances: [{ balance_type: 'CLBD', balance_amount: { amount: '100.00' } }] });
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'ledger_claim_bank_sync'
    ? { acquired: true, leaseToken: '22222222-2222-4222-8222-222222222222', dateFrom: '2026-11-01', fetchBalance: true }
    : name === 'ledger_import_statement' ? { rows_new: 1, rows_duplicate: 0 } : true, error: null }));
});

afterEach(() => {
  delete process.env.ENABLE_BANKING_ACCOUNT_UID;
  delete process.env.ENABLE_BANKING_SESSION_ID;
  delete process.env.ENABLE_BANKING_VALID_UNTIL;
});

describe('persisted Montepio synchronization', () => {
  it('does not read the bank when another process has the lease or the next attempt is not due', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { acquired: false, nextAttemptAt: '2026-11-05T06:00:00Z' }, error: null });
    expect(await syncMontepio()).toEqual({ status: 'waiting', nextAttemptAt: '2026-11-05T06:00:00Z' });
    expect(mocks.transactions).not.toHaveBeenCalled();
    expect(mocks.balances).not.toHaveBeenCalled();
  });

  it('imports booked movements with their provider ID and records the last balance', async () => {
    const result = await syncMontepio();
    expect(result.status).toBe('synced');
    const call = mocks.rpc.mock.calls.find(([name]) => name === 'ledger_import_statement');
    expect(call?.[1].p_rows).toMatchObject([{ provider_tx_id: 'provider-1', amount: '25.00', parsed_kind: 'incoming_transfer' }]);
    expect(mocks.rpc).toHaveBeenCalledWith('ledger_finish_bank_sync', expect.objectContaining({
      p_success: true, p_rate_limited: false, p_balance: 100,
    }));
  });

  it('backs off after the bank rejects transaction access', async () => {
    mocks.transactions.mockRejectedValueOnce(new Error('429 ASPSP_RATE_LIMIT_EXCEEDED'));
    expect((await syncMontepio()).status).toBe('rate_limited');
    expect(mocks.rpc).not.toHaveBeenCalledWith('ledger_import_statement', expect.anything());
    expect(mocks.rpc).toHaveBeenCalledWith('ledger_finish_bank_sync', expect.objectContaining({
      p_success: false, p_rate_limited: true, p_error_code: 'ASPSP_RATE_LIMIT_EXCEEDED',
    }));
  });

  it('keeps importing movements when only balances hit the daily limit', async () => {
    mocks.balances.mockRejectedValueOnce(new Error('429 ASPSP_RATE_LIMIT_EXCEEDED'));
    expect((await syncMontepio()).status).toBe('synced');
    expect(mocks.rpc).toHaveBeenCalledWith('ledger_import_statement', expect.anything());
    expect(mocks.rpc).toHaveBeenCalledWith('ledger_finish_bank_sync', expect.objectContaining({
      p_success: true, p_balance_rate_limited: true, p_balance: null,
    }));
  });
});
