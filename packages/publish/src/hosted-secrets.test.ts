import { describe, expect, test } from 'bun:test';

import { member } from '@functhis/db/schema/auth';
import { hostedSecret, packageVersion } from '@functhis/db/schema/catalog';

import {
  decryptSecretRows,
  deleteOrganizationSecret,
  deletePackageSecret,
  listOrganizationSecrets,
  listPackageSecrets,
  loadPackageVersionSecretNames,
  resolveHostedRuntimeSecrets,
  setOrganizationSecret,
  setPackageSecret,
} from './hosted-secrets';
import {
  encryptSecretValue,
  HostedSecretError,
  SECRETS_KEY_BYTES,
} from './secret-crypto';

const testKeyBytes = (): Uint8Array =>
  new Uint8Array(SECRETS_KEY_BYTES).fill(9);

const testKey = (): string => {
  const bytes = testKeyBytes();
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
};

const withLimit = <T>(rows: T[]) => {
  const result = Promise.resolve(rows) as Promise<T[]> & {
    limit: () => Promise<T[]>;
  };
  result.limit = () => Promise.resolve(rows.slice(0, 1));
  return result;
};

describe('decryptSecretRows', () => {
  test('splits organization and package values', async () => {
    const key = testKeyBytes();
    const org = await encryptSecretValue('org-value', key);
    const pkg = await encryptSecretValue('pkg-value', key);
    const decrypted = await decryptSecretRows(
      [
        {
          ciphertext: org.ciphertext,
          name: 'SHARED',
          nonce: org.nonce,
          packageId: null,
        },
        {
          ciphertext: pkg.ciphertext,
          name: 'SHARED',
          nonce: pkg.nonce,
          packageId: 'pkg-1',
        },
      ],
      key
    );
    expect(decrypted.organization).toEqual({ SHARED: 'org-value' });
    expect(decrypted.pkg).toEqual({ SHARED: 'pkg-value' });
  });
});

describe('resolveHostedRuntimeSecrets', () => {
  test('returns an empty map when no names are declared', async () => {
    await expect(
      resolveHostedRuntimeSecrets({} as never, {
        encryptionKey: testKey(),
        organizationId: 'org-1',
        packageId: 'pkg-1',
        secretNames: [],
      })
    ).resolves.toEqual({});
  });

  test('decrypts declared names and lets package values win', async () => {
    const key = testKeyBytes();
    const org = await encryptSecretValue('from-org', key);
    const pkg = await encryptSecretValue('from-pkg', key);
    const orgOnly = await encryptSecretValue('org-only', key);
    const database = {
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([
              {
                ciphertext: org.ciphertext,
                name: 'SHARED',
                nonce: org.nonce,
                packageId: null,
              },
              {
                ciphertext: orgOnly.ciphertext,
                name: 'ORG_ONLY',
                nonce: orgOnly.nonce,
                packageId: null,
              },
              {
                ciphertext: pkg.ciphertext,
                name: 'SHARED',
                nonce: pkg.nonce,
                packageId: 'pkg-1',
              },
            ]),
        }),
      }),
    };

    await expect(
      resolveHostedRuntimeSecrets(database as never, {
        encryptionKey: testKey(),
        organizationId: 'org-1',
        packageId: 'pkg-1',
        secretNames: ['SHARED', 'ORG_ONLY'],
      })
    ).resolves.toEqual({ ORG_ONLY: 'org-only', SHARED: 'from-pkg' });
  });
});

describe('listOrganizationSecrets', () => {
  test('returns names only for members', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === member) {
              return withLimit([{ organizationId: 'org-1', role: 'member' }]);
            }
            expect(table).toBe(hostedSecret);
            return Promise.resolve([
              {
                name: 'API_KEY',
                packageId: null,
                updatedAt: new Date('2026-01-01T00:00:00.000Z'),
              },
            ]);
          },
        }),
      }),
    };

    const listed = await listOrganizationSecrets(
      database as never,
      'user-1',
      'org-1'
    );
    expect(listed).toEqual({
      canWrite: false,
      secrets: [
        {
          name: 'API_KEY',
          scope: 'organization',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });
    expect(JSON.stringify(listed)).not.toContain('ciphertext');
  });

  test('returns null for non-members', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => withLimit([]),
        }),
      }),
    };
    await expect(
      listOrganizationSecrets(database as never, 'user-1', 'org-1')
    ).resolves.toBeNull();
  });
});

describe('setOrganizationSecret', () => {
  test('inserts ciphertext for an admin and never stores plaintext', async () => {
    const inserts: unknown[] = [];
    const database = {
      insert: (table: unknown) => {
        expect(table).toBe(hostedSecret);
        return {
          values: (value: Record<string, unknown>) => {
            inserts.push(value);
            return Promise.resolve();
          },
        };
      },
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === member) {
              return withLimit([{ role: 'admin' }]);
            }
            return withLimit([]);
          },
        }),
      }),
    };

    const result = await setOrganizationSecret(database as never, {
      encryptionKey: testKey(),
      name: 'API_KEY',
      organizationId: 'org-1',
      userId: 'admin-1',
      value: 'super-secret',
    });
    expect(result).toMatchObject({ name: 'API_KEY', scope: 'organization' });
    expect(inserts).toHaveLength(1);
    const stored = inserts[0] as Record<string, unknown>;
    expect(stored.ciphertext).not.toBe('super-secret');
    expect(stored.nonce).toEqual(expect.any(String));
    expect(JSON.stringify(inserts)).not.toContain('super-secret');
  });

  test('rejects members who are not admins', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => withLimit([{ role: 'member' }]),
        }),
      }),
    };
    await expect(
      setOrganizationSecret(database as never, {
        encryptionKey: testKey(),
        name: 'API_KEY',
        organizationId: 'org-1',
        userId: 'member-1',
        value: 'x',
      })
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  test('rejects invalid names and empty values', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => withLimit([{ role: 'owner' }]),
        }),
      }),
    };
    await expect(
      setOrganizationSecret(database as never, {
        encryptionKey: testKey(),
        name: 'bad-name',
        organizationId: 'org-1',
        userId: 'owner-1',
        value: 'ok',
      })
    ).rejects.toBeInstanceOf(HostedSecretError);
    await expect(
      setOrganizationSecret(database as never, {
        encryptionKey: testKey(),
        name: 'API_KEY',
        organizationId: 'org-1',
        userId: 'owner-1',
        value: '',
      })
    ).rejects.toMatchObject({ code: 'invalid_value' });
  });
});

describe('setPackageSecret', () => {
  test('updates an existing package secret', async () => {
    const updates: unknown[] = [];
    const database = {
      select: () => ({
        from: () => ({
          where: () => withLimit([{ id: 'sec-1' }]),
        }),
      }),
      update: (table: unknown) => {
        expect(table).toBe(hostedSecret);
        return {
          set: (value: unknown) => {
            updates.push(value);
            return { where: () => Promise.resolve() };
          },
        };
      },
    };

    await setPackageSecret(database as never, {
      encryptionKey: testKey(),
      name: 'TOKEN',
      packageRow: {
        id: 'pkg-1',
        organizationId: 'org-1',
        ownerUserId: 'owner-1',
      },
      userId: 'owner-1',
      value: 'rotated',
    });
    expect(updates).toHaveLength(1);
    expect(JSON.stringify(updates)).not.toContain('rotated');
  });
});

describe('listPackageSecrets', () => {
  test('returns package-scoped names for the owner', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === hostedSecret) {
              return Promise.resolve([
                {
                  name: 'TOKEN',
                  packageId: 'pkg-1',
                  updatedAt: new Date('2026-02-01T00:00:00.000Z'),
                },
              ]);
            }
            return withLimit([]);
          },
        }),
      }),
    };
    await expect(
      listPackageSecrets(database as never, 'owner-1', {
        id: 'pkg-1',
        organizationId: 'org-1',
        ownerUserId: 'owner-1',
      })
    ).resolves.toEqual({
      canWrite: true,
      secrets: [
        {
          name: 'TOKEN',
          scope: 'package',
          updatedAt: new Date('2026-02-01T00:00:00.000Z'),
        },
      ],
    });
  });
});

describe('deletePackageSecret', () => {
  test('deletes for the package owner', async () => {
    let deleted = false;
    const database = {
      delete: (table: unknown) => {
        expect(table).toBe(hostedSecret);
        return {
          where: () => {
            deleted = true;
            return Promise.resolve();
          },
        };
      },
    };
    await deletePackageSecret(database as never, {
      name: 'TOKEN',
      packageRow: {
        id: 'pkg-1',
        organizationId: 'org-1',
        ownerUserId: 'owner-1',
      },
      userId: 'owner-1',
    });
    expect(deleted).toBe(true);
  });
});

describe('deleteOrganizationSecret', () => {
  test('deletes for an owner', async () => {
    let deleted = false;
    const database = {
      delete: (table: unknown) => {
        expect(table).toBe(hostedSecret);
        return {
          where: () => {
            deleted = true;
            return Promise.resolve();
          },
        };
      },
      select: () => ({
        from: () => ({
          where: () => withLimit([{ role: 'owner' }]),
        }),
      }),
    };
    await deleteOrganizationSecret(database as never, {
      name: 'API_KEY',
      organizationId: 'org-1',
      userId: 'owner-1',
    });
    expect(deleted).toBe(true);
  });
});

describe('loadPackageVersionSecretNames', () => {
  test('returns stored names or an empty list', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => {
          expect(table).toBe(packageVersion);
          return {
            where: () => withLimit([{ secretNames: ['API_KEY'] }]),
          };
        },
      }),
    };
    await expect(
      loadPackageVersionSecretNames(database as never, 'ver-1')
    ).resolves.toEqual(['API_KEY']);
  });
});
