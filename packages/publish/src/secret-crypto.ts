import { resolveSecret } from '@functhis/db';
import type { SecretBinding } from '@functhis/db';

export const SECRETS_KEY_VERSION = 1;
export const SECRETS_KEY_BYTES = 32;
const AES_GCM = 'AES-GCM';
const NONCE_BYTES = 12;

export type HostedSecretErrorCode =
  | 'decrypt_failed'
  | 'invalid_name'
  | 'invalid_value'
  | 'missing_key'
  | 'unauthorized';

export class HostedSecretError extends Error {
  readonly code: HostedSecretErrorCode;

  constructor(message: string, code: HostedSecretErrorCode) {
    super(message);
    this.name = 'HostedSecretError';
    this.code = code;
  }
}

const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
};

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0;
  }
  return bytes;
};

export const parseSecretsKeyBytes = (raw: string): Uint8Array => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new HostedSecretError(
      'FUNCTHIS_SECRETS_KEY is not set',
      'missing_key'
    );
  }

  try {
    const bytes = decodeBase64(trimmed);
    if (bytes.byteLength === SECRETS_KEY_BYTES) {
      return bytes;
    }
  } catch {
    // Fall through to the same missing-key error so callers never see decode details.
  }

  throw new HostedSecretError('FUNCTHIS_SECRETS_KEY is not set', 'missing_key');
};

export const resolveSecretsKeyBytes = async (
  binding: SecretBinding | undefined
): Promise<Uint8Array> => {
  if (binding === undefined) {
    throw new HostedSecretError(
      'FUNCTHIS_SECRETS_KEY is not set',
      'missing_key'
    );
  }

  const raw = await resolveSecret(binding);
  return parseSecretsKeyBytes(raw);
};

const toArrayBufferView = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
};

const importAesGcmKey = (keyBytes: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    toArrayBufferView(keyBytes),
    { name: AES_GCM },
    false,
    ['decrypt', 'encrypt']
  );

export const encryptSecretValue = async (
  plaintext: string,
  keyBytes: Uint8Array
): Promise<{ ciphertext: string; nonce: string }> => {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const key = await importAesGcmKey(keyBytes);
  const ciphertext = await crypto.subtle.encrypt(
    { iv: nonce, name: AES_GCM },
    key,
    new TextEncoder().encode(plaintext)
  );

  return {
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    nonce: encodeBase64(nonce),
  };
};

export const decryptSecretValue = async (
  payload: { ciphertext: string; nonce: string },
  keyBytes: Uint8Array
): Promise<string> => {
  try {
    const key = await importAesGcmKey(keyBytes);
    const plaintext = await crypto.subtle.decrypt(
      { iv: toArrayBufferView(decodeBase64(payload.nonce)), name: AES_GCM },
      key,
      toArrayBufferView(decodeBase64(payload.ciphertext))
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new HostedSecretError(
      'Failed to decrypt package secret',
      'decrypt_failed'
    );
  }
};
