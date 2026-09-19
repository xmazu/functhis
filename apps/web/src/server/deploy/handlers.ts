import { validateDeployBearerToken } from '@functhis/auth';
import { user } from '@functhis/db/schema/auth';
import { pkg, packageVersion, pkgFunction } from '@functhis/db/schema/catalog';
import {
  bundleKvKey,
  resolveDeploySharingForDeployStart,
  sha256Hex,
  stableBundlePayload,
  utf8ByteLength,
} from '@functhis/deploy';
import { and, eq, notInArray } from 'drizzle-orm';

import { env } from '../../env.server';
import { getDb } from '../../services';
import {
  BUNDLE_KV_PREFIX,
  MAX_BUNDLE_BYTES,
  MAX_SOURCE_MANIFEST_BYTES,
  MAX_SOURCE_MANIFEST_FILES,
} from './constants';
import { deployFinalizeBodySchema, deployStartBodySchema } from './schemas';
import type { WorkerLoaderBundle } from './schemas';

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status });

const badRequest = (message: string): Response => json({ error: message }, 400);

const validateManifest = (
  files: { path: string; bytes: number }[]
): string | null => {
  if (files.length > MAX_SOURCE_MANIFEST_FILES) {
    return `Too many files (max ${MAX_SOURCE_MANIFEST_FILES})`;
  }
  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.bytes;
    if (totalBytes > MAX_SOURCE_MANIFEST_BYTES) {
      return `Source manifest too large (max ${MAX_SOURCE_MANIFEST_BYTES} bytes)`;
    }
  }
  return null;
};

const validateBundleSize = (bundle: WorkerLoaderBundle): string | null => {
  const payload = stableBundlePayload(bundle);
  if (utf8ByteLength(payload) > MAX_BUNDLE_BYTES) {
    return `Bundle too large (max ${MAX_BUNDLE_BYTES} bytes)`;
  }
  if (bundle.modules[bundle.mainModule] === undefined) {
    return 'mainModule missing from modules map';
  }
  return null;
};

const deployAuth = (
  request: Request,
  database: Awaited<ReturnType<typeof getDb>>
) =>
  validateDeployBearerToken(database, request, { consoleUrl: env.CONSOLE_URL });

export const handleDeployStart = async (
  request: Request
): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const database = await getDb();
  const auth = await deployAuth(request, database);
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const parsed = deployStartBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const manifestError = validateManifest(parsed.data.filesManifest);
  if (manifestError) {
    return badRequest(manifestError);
  }

  const [existingPackage] = await database
    .select()
    .from(pkg)
    .where(
      and(eq(pkg.ownerUserId, auth.userId), eq(pkg.slug, parsed.data.slug))
    )
    .limit(1);

  const sharing = await resolveDeploySharingForDeployStart(
    database,
    auth.userId,
    {
      organizationSlug: parsed.data.organizationSlug,
      visibility: parsed.data.visibility,
    },
    existingPackage
      ? {
          organizationId: existingPackage.organizationId,
          visibility: existingPackage.visibility,
        }
      : null
  );
  if (!sharing.ok) {
    return badRequest(sharing.error);
  }

  const { organizationId, visibility } = sharing.value;

  let packageRow = existingPackage;
  if (packageRow) {
    if (
      packageRow.organizationId !== organizationId ||
      packageRow.visibility !== visibility
    ) {
      await database
        .update(pkg)
        .set({ organizationId, visibility })
        .where(eq(pkg.id, packageRow.id));
      packageRow = { ...packageRow, organizationId, visibility };
    }
  } else {
    const [inserted] = await database
      .insert(pkg)
      .values({
        organizationId,
        ownerUserId: auth.userId,
        slug: parsed.data.slug,
        visibility,
      })
      .returning();
    if (!inserted) {
      return new Response('Failed to create package', { status: 500 });
    }
    packageRow = inserted;
  }

  if (!packageRow) {
    return new Response('Failed to create package', { status: 500 });
  }

  return json({ packageId: packageRow.id });
};

export const handleDeployFinalize = async (
  request: Request
): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const database = await getDb();
  const auth = await deployAuth(request, database);
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const parsed = deployFinalizeBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const bundleError = validateBundleSize(parsed.data.bundle);
  if (bundleError) {
    return badRequest(bundleError);
  }

  const expectedHash = await sha256Hex(stableBundlePayload(parsed.data.bundle));
  if (expectedHash !== parsed.data.bundleHash) {
    return badRequest('bundleHash does not match bundle contents');
  }

  const [packageRow] = await database
    .select()
    .from(pkg)
    .where(
      and(eq(pkg.id, parsed.data.packageId), eq(pkg.ownerUserId, auth.userId))
    )
    .limit(1);

  if (!packageRow) {
    return new Response('Not Found', { status: 404 });
  }

  const [owner] = await database
    .select({ handle: user.handle })
    .from(user)
    .where(eq(user.id, packageRow.ownerUserId))
    .limit(1);

  if (!owner?.handle) {
    return new Response('Owner handle not found', { status: 500 });
  }

  const kvKey = bundleKvKey(parsed.data.bundleHash);
  const kvPayload = JSON.stringify({
    mainModule: parsed.data.bundle.mainModule,
    modules: parsed.data.bundle.modules,
  });

  try {
    await env.BUNDLES.put(kvKey, kvPayload);
  } catch {
    return new Response('Bundle storage failed; retry finalize', {
      status: 503,
    });
  }

  let version;
  try {
    version = await database.transaction(async (tx) => {
      const [insertedVersion] = await tx
        .insert(packageVersion)
        .values({
          bundleHash: parsed.data.bundleHash,
          contracts: parsed.data.contracts,
          createdBy: auth.userId,
          packageId: packageRow.id,
          sourceHash: parsed.data.sourceHash.toLowerCase(),
        })
        .returning();

      if (!insertedVersion) {
        throw new Error('Failed to create package version');
      }

      const deployedSlugs = parsed.data.contracts.map((fn) => fn.slug);

      await Promise.all(
        parsed.data.contracts.map((fn) =>
          tx
            .insert(pkgFunction)
            .values({
              contract: fn.contract,
              exportName: fn.exportName,
              packageId: packageRow.id,
              path: fn.path,
              slug: fn.slug,
            })
            .onConflictDoUpdate({
              set: {
                contract: fn.contract,
                exportName: fn.exportName,
                path: fn.path,
                updatedAt: new Date(),
              },
              target: [pkgFunction.packageId, pkgFunction.slug],
            })
        )
      );

      await tx
        .delete(pkgFunction)
        .where(
          and(
            eq(pkgFunction.packageId, packageRow.id),
            notInArray(pkgFunction.slug, deployedSlugs)
          )
        );

      await tx
        .update(pkg)
        .set({ currentVersionId: insertedVersion.id })
        .where(eq(pkg.id, packageRow.id));

      return insertedVersion;
    });
  } catch {
    return new Response('Failed to record package version', { status: 500 });
  }

  return json({
    bundleHash: parsed.data.bundleHash,
    bundleKvKey: kvKey.replace(BUNDLE_KV_PREFIX, ''),
    currentVersionId: version.id,
    functions: parsed.data.contracts.map((fn) => ({ slug: fn.slug })),
    handle: owner.handle,
    packageId: packageRow.id,
    slug: packageRow.slug,
    versionId: version.id,
  });
};
