import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transactions: vi.fn(), balances: vi.fn(), session: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('../lib/ledger/enable-banking', () => ({
  fetchTransactions: mocks.transactions,
  fetchBalances: mocks.balances,
  getSession: mocks.session,
  toStatementLine: (value: unknown) => value,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.ENABLE_BANKING_ACCOUNT_UID = 'test-account';
  delete process.env.ENABLE_BANKING_SESSION_ID;
  mocks.transactions.mockResolvedValue([]);
  mocks.balances.mockResolvedValue({ balances: [{ balance_type: 'CLBD', balance_amount: { amount: '100.00', currency: 'EUR' } }] });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ENABLE_BANKING_ACCOUNT_UID;
});

describe('Montepio live snapshot', () => {
  it('keeps movements available when only the balances endpoint reaches its daily limit', async () => {
    mocks.balances.mockRejectedValue(new Error('429 ASPSP_RATE_LIMIT_EXCEEDED'));
    const { loadBankLive } = await import('../lib/ledger/bank-live');
    const snapshot = await loadBankLive();
    expect(snapshot.balance).toBeNull();
    expect(snapshot.movements).toEqual([]);
    await loadBankLive({ force: true });
    expect(mocks.transactions).toHaveBeenCalledTimes(1);
    expect(mocks.balances).toHaveBeenCalledTimes(1);
  });

  it('updates movements again after six hours while backing off only the limited balance endpoint', async () => {
    const start = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(start);
    mocks.balances.mockRejectedValue(new Error('429 ASPSP_RATE_LIMIT_EXCEEDED'));
    const { loadBankLive } = await import('../lib/ledger/bank-live');
    const first = await loadBankLive();
    expect(Date.parse(first.nextRefreshAt)).toBe(start + 6 * 60 * 60 * 1000);
    vi.mocked(Date.now).mockReturnValue(start + 6 * 60 * 60 * 1000 + 1);
    const second = await loadBankLive();
    expect(second.balanceLimited).toBe(true);
    expect(mocks.transactions).toHaveBeenCalledTimes(2);
    expect(mocks.balances).toHaveBeenCalledTimes(1);
  });

  it('merges recent transactions into the cached history on later reads', async () => {
    const start = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(start);
    const makeTransaction = (id: string, date: string) => ({
      entry_reference: id, booking_date: date, transaction_amount: { amount: '10.00', currency: 'EUR' },
      credit_debit_indicator: 'CRDT', bookingDate: date, valueDate: date, amount: 10,
      description: `TR-IPS-${id}`, providerTxId: id, booked: true, balanceAfter: null, counterpartyName: id,
    });
    const first = makeTransaction('first', new Date(start - 5 * 86400000).toISOString().slice(0, 10));
    const second = makeTransaction('second', new Date(start).toISOString().slice(0, 10));
    mocks.transactions.mockResolvedValueOnce([first]).mockResolvedValueOnce([first, second]);
    const { loadBankLive } = await import('../lib/ledger/bank-live');
    expect((await loadBankLive()).movements).toHaveLength(1);
    vi.mocked(Date.now).mockReturnValue(start + 6 * 60 * 60 * 1000 + 1);
    expect((await loadBankLive()).movements).toHaveLength(2);
    expect(mocks.transactions.mock.calls[1][1]).toBe(new Date(start + 6 * 60 * 60 * 1000 + 1 - 7 * 86400000).toISOString().slice(0, 10));
  });

  it('explains the daily limit when transactions are unavailable', async () => {
    mocks.transactions.mockRejectedValue(new Error('429 ASPSP_RATE_LIMIT_EXCEEDED'));
    const { loadBankLive } = await import('../lib/ledger/bank-live');
    await expect(loadBankLive()).rejects.toThrow('limite diário');
    await expect(loadBankLive({ force: true })).rejects.toThrow('limite diário');
    expect(mocks.transactions).toHaveBeenCalledTimes(1);
  });
});
