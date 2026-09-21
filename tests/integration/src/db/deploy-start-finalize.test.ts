import { describe, expect, test } from 'bun:test';

import { pkg, packageVersion, pkgFunction } from '@functhis/db/schema/catalog';
import { bundleKvKey, sha256Hex, stableBundlePayload } from '@functhis/deploy';
import { handleDeployFinalize, handleDeployStart } from '@functhis/deploy/http';
import { eq } from 'drizzle-orm';

import { integrationDb } from '../harness/db';
import { createIntegrationDeployContext } from '../harness/deploy-context';
import { createMemoryBundles } from '../harness/memory-kv';
import { seedIntegrationDeployAuth } from '../harness/seed';

describe('deploy start and finalize', () => {
  test('rejects deploy start without bearer token', async () => {
    const db = await integrationDb();
    const memoryKv = createMemoryBundles();
    const ctx = createIntegrationDeployContext(db, memoryKv);
    const response = await handleDeployStart(
      new Request('http://localhost/api/deploy/start', {
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

  test('deploys through start then finalize', async () => {
    const db = await integrationDb();
    const memoryKv = createMemoryBundles();
    const ctx = createIntegrationDeployContext(db, memoryKv);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken } = await seedIntegrationDeployAuth(db, suffix);

    const slug = `pkg-${suffix}`;
    const startResponse = await handleDeployStart(
      new Request('http://localhost/api/deploy/start', {
        body: JSON.stringify({
          filesManifest: [{ bytes: 42, path: 'hello.ts' }],
          slug,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
      ctx
    );
    expect(startResponse.status).toBe(200);
    const startBody = (await startResponse.json()) as { packageId: string };

    const bundle = {
      mainModule: 'main.js',
      modules: { 'main.js': 'export default async () => ({ ok: true });' },
    };
    const bundleHash = await sha256Hex(stableBundlePayload(bundle));
    const sourceHash = 'abcdef0123456';
    const contracts = [
      {
        contract: { description: 'hello' },
        exportName: 'default',
        path: 'hello.ts',
        slug: 'hello',
      },
    ];

    const finalizeResponse = await handleDeployFinalize(
      new Request('http://localhost/api/deploy/finalize', {
        body: JSON.stringify({
          bundle,
          bundleHash,
          contracts,
          packageId: startBody.packageId,
          sourceHash,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
      ctx
    );
    expect(finalizeResponse.status).toBe(200);

    const finalizeBody = (await finalizeResponse.json()) as {
      bundleHash: string;
      versionId: string;
    };
    expect(finalizeBody.bundleHash).toBe(bundleHash);

    const kvKey = bundleKvKey(bundleHash);
    expect(memoryKv.get(kvKey)).toBeDefined();

    const [packageRow] = await db
      .select()
      .from(pkg)
      .where(eq(pkg.id, startBody.packageId))
      .limit(1);
    expect(packageRow?.currentVersionId).toBe(finalizeBody.versionId);

    const versions = await db
      .select()
      .from(packageVersion)
      .where(eq(packageVersion.packageId, startBody.packageId));
    expect(versions.length).toBe(1);

    const functions = await db
      .select()
      .from(pkgFunction)
      .where(eq(pkgFunction.packageId, startBody.packageId));
    expect(functions.map((fn) => fn.slug)).toEqual(['hello']);
  });
});
