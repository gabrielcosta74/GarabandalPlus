import { describe, expect, it } from 'vitest';

import { FactPtError } from '../lib/factpt/client';
import { factPtReconciliationErrorCode } from '../lib/factpt/processor';

function factError(
  kind: 'timeout' | 'network' | 'invalid_response' | 'validation',
  retryable = true,
) {
  return new FactPtError({
    message: `FACT.pt ${kind}`,
    kind,
    retryable,
  });
}

describe('FACT.pt ambiguous emission protection', () => {
  it.each(['timeout', 'network', 'invalid_response'] as const)(
    'requires reconciliation after an ambiguous %s during emission',
    (kind) => {
      expect(
        factPtReconciliationErrorCode(factError(kind), true, false),
      ).toBe(`${kind}_reconciliation_required`);
    },
  );

  it('does not quarantine a network failure before emission starts', () => {
    expect(
      factPtReconciliationErrorCode(factError('network'), false, false),
    ).toBeNull();
  });

  it('does not classify a rejected validation request as an ambiguous issue', () => {
    expect(
      factPtReconciliationErrorCode(
        factError('validation', false),
        true,
        false,
      ),
    ).toBeNull();
  });

  it('requires reconciliation when FACT.pt returned a document but persistence failed', () => {
    expect(
      factPtReconciliationErrorCode(
        new Error('database unavailable'),
        true,
        true,
      ),
    ).toBe('issued_persistence_reconciliation_required');
  });
});
