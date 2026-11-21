import { describe, expect, test } from 'bun:test';

import {
  decryptSecretValue,
  encryptSecretValue,
  HostedSecretError,
  parseSecretsKeyBytes,
  resolveSecretsKeyBytes,
  SECRETS_KEY_BYTES,
} from './secret-crypto';

const testKeyBytes = (): Uint8Array =>
  new Uint8Array(SECRETS_KEY_BYTES).fill(7);

const testKey = (): string => {
  const bytes = testKeyBytes();
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
};

describe('parseSecretsKeyBytes', () => {
  test('accepts a 32-byte base64 key', () => {
    expect(parseSecretsKeyBytes(testKey())).toEqual(testKeyBytes());
  });

  test('rejects empty and invalid keys without leaking details', () => {
    expect(() => parseSecretsKeyBytes('')).toThrow(HostedSecretError);
    expect(() => parseSecretsKeyBytes('not-base64!!!')).toThrow(
      /FUNCTHIS_SECRETS_KEY is not set/u
    );
    expect(() => parseSecretsKeyBytes(btoa('short'))).toThrow(
      HostedSecretError
    );
  });
});

describe('resolveSecretsKeyBytes', () => {
  test('resolves a string binding', async () => {
    await expect(resolveSecretsKeyBytes(testKey())).resolves.toEqual(
      testKeyBytes()
    );
  });

  test('resolves a Secrets Store-style binding', async () => {
    await expect(
      resolveSecretsKeyBytes({ get: () => Promise.resolve(testKey()) })
    ).resolves.toEqual(testKeyBytes());
  });

  test('rejects a missing binding', async () => {
    await expect(resolveSecretsKeyBytes()).rejects.toBeInstanceOf(
      HostedSecretError
    );
  });
});

describe('encryptSecretValue', () => {
  test('round-trips plaintext and uses a unique nonce', async () => {
    const key = testKeyBytes();
    const first = await encryptSecretValue('token-a', key);
    const second = await encryptSecretValue('token-a', key);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    await expect(decryptSecretValue(first, key)).resolves.toBe('token-a');
    await expect(decryptSecretValue(second, key)).resolves.toBe('token-a');
  });

  test('fails closed on tampered ciphertext', async () => {
    const key = testKeyBytes();
    const encrypted = await encryptSecretValue('secret', key);
    await expect(
      decryptSecretValue(
        { ciphertext: encrypted.nonce, nonce: encrypted.nonce },
        key
      )
    ).rejects.toMatchObject({ code: 'decrypt_failed' });
  });
});
