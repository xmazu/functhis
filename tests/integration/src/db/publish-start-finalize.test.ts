import { describe, expect, test } from 'bun:test';

import { pkg, packageVersion, pkgFunction } from '@functhis/db/schema/catalog';
import {
  artifactPrefix,
  bundleKvKey,
  getPackageBySlugs,
  hashPublishArtifact,
  MAX_SOURCE_MANIFEST_FILES,
} from '@functhis/publish';
import {
  handlePublishFinalize,
  handlePublishStart,
} from '@functhis/publish/http';
import { eq } from 'drizzle-orm';

import { integrationDb } from '../harness/db';
import { createMemoryBundles } from '../harness/memory-kv';
import {
  artifactObjectKeys,
  finalizePackage,
  sampleArtifact,
  startPackage,
} from '../harness/publish';
import { createIntegrationPublishContext } from '../harness/publish-context';
import {
  seedIntegrationPublishAuth,
  seedIntegrationOrganization,
} from '../harness/seed';

describe('deploy start and finalize', () => {
  test('rejects deploy start without bearer token', async () => {
    const db = await integrationDb();
    const ctx = createIntegrationPublishContext(db);
    const response = await handlePublishStart(
      new Request('http://localhost/api/publish/start', {
        body: JSON.stringify({
          filesManifest: [{ bytes: 10, path: 'hello.ts' }],
          slug: 'hello-world',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
      ctx
    );
    expect(response.status).toBe(401);
  });

  test('rejects non-POST methods and invalid JSON', async () => {
    const db = await integrationDb();
    const ctx = createIntegrationPublishContext(db);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken } = await seedIntegrationPublishAuth(db, suffix);

    const methodResponse = await handlePublishStart(
      new Request('http://localhost/api/publish/start', {
        headers: { Authorization: `Bearer ${accessToken}` },
        method: 'GET',
      }),
      ctx
    );
    expect(methodResponse.status).toBe(405);

    const jsonResponse = await handlePublishStart(
      new Request('http://localhost/api/publish/start', {
        body: '{',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
      ctx
    );
    expect(jsonResponse.status).toBe(400);
  });

  test('rejects oversized source manifests', async () => {
    const db = await integrationDb();
    const ctx = createIntegrationPublishContext(db);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken } = await seedIntegrationPublishAuth(db, suffix);
    const filesManifest = Array.from(
      { length: MAX_SOURCE_MANIFEST_FILES + 1 },
      (_, index) => ({ bytes: 1, path: `f${index}.ts` })
    );
    const response = await startPackage(ctx, accessToken, {
      filesManifest,
      slug: `pkg-${suffix}`,
    });
    expect(response.status).toBe(400);
  });

  test('deploys through start then finalize', async () => {
    const db = await integrationDb();
    const memoryKv = createMemoryBundles();
    const memoryArtifacts = createMemoryBundles();
    const ctx = createIntegrationPublishContext(db, memoryKv, memoryArtifacts);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken, handle } = await seedIntegrationPublishAuth(
      db,
      suffix
    );

    const slug = `pkg-${suffix}`;
    const startResponse = await startPackage(ctx, accessToken, {
      filesManifest: [{ bytes: 42, path: 'hello.ts' }],
      slug,
    });
    expect(startResponse.status).toBe(200);
    const startBody = (await startResponse.json()) as { packageId: string };

    const artifact = sampleArtifact(slug);
    const contentHash = await hashPublishArtifact(artifact);
    const finalizeResponse = await finalizePackage(ctx, accessToken, {
      gitDirty: true,
      gitSha: 'abc1234',
      packageId: startBody.packageId,
      slug,
    });
    expect(finalizeResponse.status).toBe(200);

    const finalizeBody = (await finalizeResponse.json()) as {
      artifactKey: string;
      bundleHash: string;
      handle: string;
      semver: string;
      versionId: string;
    };
    expect(finalizeBody.semver).toBe('1.0.0');
    expect(finalizeBody.handle).toBe(handle);
    expect(finalizeBody.artifactKey).toBe(artifactPrefix(contentHash));
    expect(memoryKv.get(bundleKvKey(finalizeBody.bundleHash))).toBeDefined();
    for (const key of artifactObjectKeys(contentHash)) {
      expect(memoryArtifacts.get(key)).toBeDefined();
    }

    const [packageRow] = await db
      .select()
      .from(pkg)
      .where(eq(pkg.id, startBody.packageId))
      .limit(1);
    expect(packageRow?.currentVersionId).toBe(finalizeBody.versionId);
    expect(packageRow?.organizationId).toBeDefined();

    const versions = await db
      .select()
      .from(packageVersion)
      .where(eq(packageVersion.packageId, startBody.packageId));
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      gitDirty: true,
      gitSha: 'abc1234',
      secretNames: [],
      semver: '1.0.0',
    });

    const functions = await db
      .select()
      .from(pkgFunction)
      .where(eq(pkgFunction.packageId, startBody.packageId));
    expect(functions.map((fn) => fn.slug)).toEqual(['hello']);

    const catalog = await getPackageBySlugs(db, handle, slug);
    expect(catalog?.organizationId).toBeDefined();
    expect(catalog?.currentVersion.semver).toBe('1.0.0');
    expect(catalog?.currentVersion.publishedAt).toBeInstanceOf(Date);
    expect(catalog?.functions.map((fn) => fn.functionSlug)).toEqual(['hello']);
  });

  test('persists manifest secret names on the package version', async () => {
    const db = await integrationDb();
    const ctx = createIntegrationPublishContext(db);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken } = await seedIntegrationPublishAuth(db, suffix);
    const slug = `pkg-${suffix}`;
    const startResponse = await startPackage(ctx, accessToken, {
      filesManifest: [{ bytes: 1, path: 'hello.ts' }],
      slug,
    });
    const { packageId } = (await startResponse.json()) as { packageId: string };
    const finalizeResponse = await finalizePackage(ctx, accessToken, {
      packageId,
      secrets: ['API_KEY', 'bad-name', 'API_KEY'],
      slug,
    });
    expect(finalizeResponse.status).toBe(200);

    const versions = await db
      .select({ secretNames: packageVersion.secretNames })
      .from(packageVersion)
      .where(eq(packageVersion.packageId, packageId));
    expect(versions[0]?.secretNames).toEqual(['API_KEY']);
  });

  test('bumps semver and replaces function slugs on a later publish', async () => {
    const db = await integrationDb();
    const ctx = createIntegrationPublishContext(db);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken } = await seedIntegrationPublishAuth(db, suffix);
    const slug = `pkg-${suffix}`;

    const startResponse = await startPackage(ctx, accessToken, {
      filesManifest: [{ bytes: 1, path: 'hello.ts' }],
      slug,
    });
    const { packageId } = (await startResponse.json()) as { packageId: string };
    const first = await finalizePackage(ctx, accessToken, { packageId, slug });
    expect(first.status).toBe(200);

    const second = await finalizePackage(ctx, accessToken, {
      bump: 'minor',
      contracts: [
        {
          contract: { description: 'greet' },
          exportName: 'default',
          path: 'greet.ts',
          slug: 'greet',
        },
      ],
      packageId,
      slug,
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { semver: string };
    expect(secondBody.semver).toBe('1.1.0');

    const functions = await db
      .select()
      .from(pkgFunction)
      .where(eq(pkgFunction.packageId, packageId));
    expect(functions.map((fn) => fn.slug)).toEqual(['greet']);
  });

  test('rejects a contentHash that does not match the artifact', async () => {
    const db = await integrationDb();
    const ctx = createIntegrationPublishContext(db);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken } = await seedIntegrationPublishAuth(db, suffix);
    const slug = `pkg-${suffix}`;
    const startResponse = await startPackage(ctx, accessToken, {
      filesManifest: [{ bytes: 1, path: 'hello.ts' }],
      slug,
    });
    const { packageId } = (await startResponse.json()) as { packageId: string };

    const response = await handlePublishFinalize(
      new Request('http://localhost/api/publish/finalize', {
        body: JSON.stringify({
          artifact: sampleArtifact(slug),
          bundle: {
            mainModule: 'main.js',
            modules: {
              'main.js': 'export default async () => ({ ok: true });',
            },
          },
          bundleHash: 'not-the-hash-value',
          contentHash: 'abcdef0123456789',
          contracts: [
            {
              contract: { description: 'hello' },
              exportName: 'default',
              path: 'hello.ts',
              slug: 'hello',
            },
          ],
          packageId,
          sourceHash: 'abcdef0123456',
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
      ctx
    );
    expect(response.status).toBe(400);
  });

  test('returns 503 when artifact storage fails', async () => {
    const db = await integrationDb();
    const failingArtifacts = {
      bundles: {
        put: () => Promise.reject(new Error('r2 down')),
      },
      get: (): string | undefined => undefined,
      keys: () => [],
    };
    const ctx = createIntegrationPublishContext(
      db,
      createMemoryBundles(),
      failingArtifacts
    );
    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken } = await seedIntegrationPublishAuth(db, suffix);
    const slug = `pkg-${suffix}`;
    const startResponse = await startPackage(ctx, accessToken, {
      filesManifest: [{ bytes: 1, path: 'hello.ts' }],
      slug,
    });
    const { packageId } = (await startResponse.json()) as { packageId: string };
    const response = await finalizePackage(ctx, accessToken, {
      packageId,
      slug,
    });
    expect(response.status).toBe(503);
  });

  test('publishes an organization-scoped package', async () => {
    const db = await integrationDb();
    const ctx = createIntegrationPublishContext(db);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken, userId } = await seedIntegrationPublishAuth(
      db,
      suffix
    );
    const org = await seedIntegrationOrganization(db, {
      slug: `int-db-org-${suffix}`,
      userIds: [userId],
    });
    const slug = `pkg-${suffix}`;
    const startResponse = await startPackage(ctx, accessToken, {
      filesManifest: [{ bytes: 1, path: 'hello.ts' }],
      scope: org.slug,
      slug,
      visibility: 'library',
    });
    expect(startResponse.status).toBe(200);
    const { packageId } = (await startResponse.json()) as { packageId: string };
    const finalizeResponse = await finalizePackage(ctx, accessToken, {
      packageId,
      slug,
    });
    expect(finalizeResponse.status).toBe(200);
    const body = (await finalizeResponse.json()) as { handle: string };
    expect(body.handle).toBe(org.slug);

    const [packageRow] = await db
      .select()
      .from(pkg)
      .where(eq(pkg.id, packageId))
      .limit(1);
    expect(packageRow?.organizationId).toBe(org.organizationId);
    expect(packageRow?.visibility).toBe('library');

    const catalog = await getPackageBySlugs(db, org.slug, slug);
    expect(catalog?.handle).toBe(org.slug);
  });

  test('rejects changing package organization after create', async () => {
    const db = await integrationDb();
    const ctx = createIntegrationPublishContext(db);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken, userId } = await seedIntegrationPublishAuth(
      db,
      suffix
    );
    const slug = `pkg-${suffix}`;
    const first = await startPackage(ctx, accessToken, {
      filesManifest: [{ bytes: 1, path: 'hello.ts' }],
      slug,
    });
    expect(first.status).toBe(200);

    const otherOrg = await seedIntegrationOrganization(db, {
      slug: `int-db-org-${suffix}`,
      userIds: [userId],
    });
    const second = await startPackage(ctx, accessToken, {
      filesManifest: [{ bytes: 1, path: 'hello.ts' }],
      scope: otherOrg.slug,
      slug,
    });
    expect(second.status).toBe(400);
  });
});
