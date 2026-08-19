import { describe, expect, it } from 'vitest';
import {
  CANONICAL_APP_URL,
  resolveAuthPublicUrl,
} from '../lib/config';

describe('authentication public URL', () => {
  it('never uses localhost for password-recovery emails', () => {
    expect(resolveAuthPublicUrl('http://localhost:3000')).toBe(CANONICAL_APP_URL);
    expect(resolveAuthPublicUrl(null, 'http://127.0.0.1:3000')).toBe(CANONICAL_APP_URL);
  });

  it('accepts an explicit stable public authentication host', () => {
    expect(resolveAuthPublicUrl('https://accounts.example.com/')).toBe('https://accounts.example.com');
  });
});
