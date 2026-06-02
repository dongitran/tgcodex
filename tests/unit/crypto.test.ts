import { describe, it, expect } from 'vitest';
import { CryptoService } from '../../src/services/crypto.js';

describe('CryptoService (AES-256-GCM)', () => {
  it('encrypts and decrypts roundtrip with good passphrase', () => {
    const secret = 'my-super-secret-telegram-session-string-1234567890';
    const pw = 'correct horse battery staple 42';
    const blob = CryptoService.encrypt(secret, pw);
    expect(blob.data).toContain(':');

    const back = CryptoService.decrypt(blob, pw);
    expect(back).toBe(secret);
  });

  it('throws on wrong passphrase', () => {
    const blob = CryptoService.encrypt('data', 'goodpass123456');
    expect(() => CryptoService.decrypt(blob, 'wrongpass')).toThrow(/wrong passphrase|Decryption failed/);
  });

  it('throws on too short passphrase', () => {
    expect(() => CryptoService.encrypt('x', 'short')).toThrow(/at least 8/);
  });

  it('rejects tampered data', () => {
    const blob = CryptoService.encrypt('secret', 'passphrase1234');
    const tampered = { data: blob.data.replace(/.$/, 'X') }; // flip last char
    expect(() => CryptoService.decrypt(tampered as any, 'passphrase1234')).toThrow();
  });
});
