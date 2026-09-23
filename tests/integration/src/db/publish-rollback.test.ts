import { describe, expect, test } from 'bun:test';

import { pkg } from '@functhis/db/schema/catalog';
import { handlePublishRollback } from '@functhis/publish/http';
import { eq } from 'drizzle-orm';

import { integrationDb } from '../harness/db';
import {
  deployAuthHeaders,
  finalizePackage,
  startPackage,
} from '../harness/publish';
import { createIntegrationPublishContext } from '../harness/publish-context';
import { seedIntegrationPublishAuth } from '../harness/seed';

describe('deploy rollback', () => {
  test('points currentVersionId at a previous semver', async () => {
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
    await finalizePackage(ctx, accessToken, { packageId, slug });
    const second = await finalizePackage(ctx, accessToken, {
      bump: 'patch',
      packageId,
      slug,
    });
    const secondBody = (await second.json()) as { semver: string };
    expect(secondBody.semver).toBe('1.0.1');

    const response = await handlePublishRollback(
      new Request('http://localhost/api/publish/rollback', {
        body: JSON.stringify({ semver: '1.0.0', slug }),
        headers: deployAuthHeaders(accessToken),
        method: 'POST',
      }),
      ctx
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      packageId: string;
      semver: string;
    };
    expect(body.semver).toBe('1.0.0');
    expect(body.packageId).toBe(packageId);

    const [packageRow] = await db
      .select()
      .from(pkg)
      .where(eq(pkg.id, packageId))
      .limit(1);
    expect(packageRow?.currentVersionId).toBeDefined();

    const byId = await handlePublishRollback(
      new Request('http://localhost/api/publish/rollback', {
        body: JSON.stringify({ packageId, semver: '1.0.1' }),
        headers: deployAuthHeaders(accessToken),
        method: 'POST',
      }),
      ctx
    );
    expect(byId.status).toBe(200);
    expect(((await byId.json()) as { semver: string }).semver).toBe('1.0.1');
  });

  test('rejects an unknown semver', async () => {
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
    await finalizePackage(ctx, accessToken, { packageId, slug });

    const response = await handlePublishRollback(
      new Request('http://localhost/api/publish/rollback', {
        body: JSON.stringify({ semver: '9.9.9', slug }),
        headers: deployAuthHeaders(accessToken),
        method: 'POST',
      }),
      ctx
    );
    expect(response.status).toBe(400);
  });

  test('rejects rollback without auth or a matching package', async () => {
    const db = await integrationDb();
    const ctx = createIntegrationPublishContext(db);
    const unauthenticated = await handlePublishRollback(
      new Request('http://localhost/api/publish/rollback', {
        body: JSON.stringify({ semver: '1.0.0', slug: 'missing' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
      ctx
    );
    expect(unauthenticated.status).toBe(401);

    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken } = await seedIntegrationPublishAuth(db, suffix);
    const missing = await handlePublishRollback(
      new Request('http://localhost/api/publish/rollback', {
        body: JSON.stringify({ semver: '1.0.0', slug: `missing-${suffix}` }),
        headers: deployAuthHeaders(accessToken),
        method: 'POST',
      }),
      ctx
    );
    expect(missing.status).toBe(404);
  });
});
