import { describe, expect, it } from 'vitest';
import { renderAuthRecoveryEmail } from '../lib/email-renderer';

describe('password recovery email', () => {
  it('makes the direct link primary and keeps the code as a fallback in Portuguese', () => {
    const email = renderAuthRecoveryEmail({
      recoveryLink: 'https://example.com/secure-recovery',
      codeEntryLink: 'https://example.com/auth/update-password?mode=code',
      otpCode: '123456',
      locale: 'pt',
    });

    expect(email.subject).toBe('Defina uma nova password');
    expect(email.html).toContain('Definir nova password');
    expect(email.html).toContain('https://example.com/secure-recovery');
    expect(email.html).toContain('123456');
    expect(email.html).toContain('Introduzir o código');
    expect(email.text).toContain('Código alternativo: 123456');
  });

  it('renders the recovery message in English', () => {
    const email = renderAuthRecoveryEmail({
      recoveryLink: 'https://example.com/secure-recovery',
      codeEntryLink: 'https://example.com/en/auth/update-password?mode=code',
      otpCode: '654321',
      locale: 'en',
    });

    expect(email.subject).toBe('Reset your password');
    expect(email.html).toContain('Set New Password');
    expect(email.html).toContain('Enter code instead');
    expect(email.text).toContain('Alternative code: 654321');
  });
});
