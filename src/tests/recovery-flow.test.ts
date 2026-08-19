import { describe, expect, it } from 'vitest';
import {
  isFocusedRecoveryPath,
  parseRecoveryPageState,
} from '../lib/recovery-flow';

describe('recovery flow', () => {
  it('defaults to validating a direct recovery link', () => {
    expect(parseRecoveryPageState({})).toEqual({
      initialMode: 'link',
      initialStatus: 'idle',
      initialEmail: '',
    });
  });

  it('opens the code fallback without exposing a stored email in the URL', () => {
    expect(parseRecoveryPageState({ mode: 'code' })).toEqual({
      initialMode: 'code',
      initialStatus: 'idle',
      initialEmail: '',
    });
  });

  it('supports legacy email links and invalid-link recovery states', () => {
    expect(parseRecoveryPageState({
      email: ' Person@Example.com ',
      status: 'invalid-link',
    })).toEqual({
      initialMode: 'code',
      initialStatus: 'invalid-link',
      initialEmail: 'person@example.com',
    });
  });

  it('only treats the dedicated password recovery screens as focused', () => {
    expect(isFocusedRecoveryPath('/auth/forgot-password')).toBe(true);
    expect(isFocusedRecoveryPath('/en/auth/update-password/')).toBe(true);
    expect(isFocusedRecoveryPath('/auth/confirm')).toBe(false);
    expect(isFocusedRecoveryPath('/login')).toBe(false);
  });
});
