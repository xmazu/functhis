import { pkg, packageVersion, pkgFunction } from '@functhis/db/schema/catalog';
import { and, eq, notInArray } from 'drizzle-orm';
import type { z } from 'zod';

import { artifactObjectKey, hashPublishArtifact } from './artifact';
import type { PublishArtifact } from './artifact';
import {
  bundleKvKey,
  sha256Hex,
  stableBundlePayload,
  utf8ByteLength,
} from './bundle';
import { listMembershipOrganizationIds } from './catalog-access';
import {
  BUNDLE_KV_PREFIX,
  MAX_ARTIFACT_BYTES,
  MAX_BUNDLE_BYTES,
  MAX_SOURCE_MANIFEST_BYTES,
  MAX_SOURCE_MANIFEST_FILES,
  WORKER_COMPATIBILITY_DATE,
} from './constants';
import { buildFunctionSearchText } from './function-search-text';
import { syncPackageToHot } from './hot-catalog';
import type { PublishHandlerContext } from './http-context';
import {
  OrgQuotaExceededError,
  insertOrgPackageIfUnderLimit,
} from './org-entitlements';
import { resolveOrganizationSlugById } from './org-membership-read';
import {
  resolvePublishSharingForPublishStart,
  resolvePublishStartSharing,
} from './publish-sharing';
import type { ExistingPackageSharing } from './publish-sharing';
import {
  publishFinalizeBodySchema,
  publishRollbackBodySchema,
  publishStartBodySchema,
} from './schemas';
import type { WorkerLoaderBundle } from './schemas';
import { bumpSemver, highestSemver } from './semver';

export type { PublishHandlerContext } from './http-context';

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

const validateArtifactSize = (artifact: PublishArtifact): string | null => {
  if (utf8ByteLength(artifact.bundle) > MAX_BUNDLE_BYTES) {
    return `Bundle too large (max ${MAX_BUNDLE_BYTES} bytes)`;
  }
  const total =
    utf8ByteLength(artifact.bundle) +
    utf8ByteLength(artifact.sourceMap) +
    utf8ByteLength(artifact.manifestJson) +
    utf8ByteLength(artifact.buildJson);
  if (total > MAX_ARTIFACT_BYTES) {
    return `Artifact too large (max ${MAX_ARTIFACT_BYTES} bytes)`;
  }
  return null;
};

const publicHandleForPackage = (
  database: PublishHandlerContext['db'],
  packageRow: typeof pkg.$inferSelect
): Promise<string | null> => {
  if (!packageRow.organizationId) {
    return Promise.resolve(null);
  }
  return resolveOrganizationSlugById(database, packageRow.organizationId);
};

const findPackageForIdentity = async (
  database: PublishHandlerContext['db'],
  slug: string,
  organizationId: string
): Promise<typeof pkg.$inferSelect | undefined> => {
  const [row] = await database
    .select()
    .from(pkg)
    .where(and(eq(pkg.organizationId, organizationId), eq(pkg.slug, slug)))
    .limit(1);
  return row;
};

const findOwnedPackageBySlug = async (
  database: PublishHandlerContext['db'],
  ownerUserId: string,
  slug: string
): Promise<typeof pkg.$inferSelect | undefined> => {
  const [row] = await database
    .select()
    .from(pkg)
    .where(and(eq(pkg.ownerUserId, ownerUserId), eq(pkg.slug, slug)))
    .limit(1);
  return row;
};

const canPublishPackage = async (
  database: PublishHandlerContext['db'],
  userId: string,
  packageRow: typeof pkg.$inferSelect
): Promise<boolean> => {
  if (packageRow.ownerUserId === userId) {
    return true;
  }
  const organizationIds = await listMembershipOrganizationIds(database, userId);
  return organizationIds.includes(packageRow.organizationId);
};

type PublishStartBody = z.infer<typeof publishStartBodySchema>;

const readPublishStartBody = async (
  request: Request
): Promise<
  { ok: true; data: PublishStartBody } | { ok: false; response: Response }
> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: badRequest('Invalid JSON body') };
  }

  const parsed = publishStartBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: badRequest(parsed.error.message) };
  }

  const manifestError = validateManifest(parsed.data.filesManifest);
  if (manifestError) {
    return { ok: false, response: badRequest(manifestError) };
  }

  return { data: parsed.data, ok: true };
};

export const handlePublishStart = async (
  request: Request,
  ctx: PublishHandlerContext
): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const database = ctx.db;
  const auth = await ctx.authenticatePublish(request);
  if (!auth.ok) {
    return auth.response;
  }

  const startBody = await readPublishStartBody(request);
  if (!startBody.ok) {
    return startBody.response;
  }
  const parsed = { data: startBody.data };

  const sharingInput = {
    organizationSlug: parsed.data.organizationSlug,
    scope: parsed.data.scope,
    visibility: parsed.data.visibility,
  };

  const ownedRow = await findOwnedPackageBySlug(
    database,
    auth.userId,
    parsed.data.slug
  );
  const ownedPackage: ExistingPackageSharing | null = ownedRow
    ? {
        organizationId: ownedRow.organizationId,
        visibility: ownedRow.visibility,
      }
    : null;

  let orgPackageInTargetOrg: ExistingPackageSharing | null = null;
  if (!ownedPackage) {
    const preview = await resolvePublishStartSharing(
      database,
      auth.userId,
      sharingInput,
      null,
      null
    );
    if (!preview.ok) {
      return badRequest(preview.error);
    }
    const orgRow = await findPackageForIdentity(
      database,
      parsed.data.slug,
      preview.value.organizationId
    );
    if (orgRow) {
      orgPackageInTargetOrg = {
        organizationId: orgRow.organizationId,
        visibility: orgRow.visibility,
      };
    }
  }

  const sharing = await resolvePublishStartSharing(
    database,
    auth.userId,
    sharingInput,
    ownedPackage,
    orgPackageInTargetOrg
  );
  if (!sharing.ok) {
    return badRequest(sharing.error);
  }

  const { organizationId, visibility } = sharing.value;

  if (ownedRow && ownedRow.organizationId !== organizationId) {
    return badRequest('Cannot change package organization');
  }

  let packageRow =
    (await findPackageForIdentity(
      database,
      parsed.data.slug,
      organizationId
    )) ?? undefined;
  if (packageRow) {
    if (packageRow.visibility !== visibility) {
      await database
        .update(pkg)
        .set({ visibility })
        .where(eq(pkg.id, packageRow.id));
      packageRow = { ...packageRow, visibility };
    }
  } else {
    try {
      packageRow = await insertOrgPackageIfUnderLimit(database, {
        organizationId,
        ownerUserId: auth.userId,
        slug: parsed.data.slug,
        visibility,
      });
    } catch (error) {
      if (error instanceof OrgQuotaExceededError) {
        return badRequest(error.message);
      }
      throw error;
    }
  }

  if (!packageRow) {
    return new Response('Failed to create package', { status: 500 });
  }

  return json({ packageId: packageRow.id });
};

export const handlePublishFinalize = async (
  request: Request,
  ctx: PublishHandlerContext
): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const database = ctx.db;
  const auth = await ctx.authenticatePublish(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const parsed = publishFinalizeBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const bundleError = validateBundleSize(parsed.data.bundle);
  if (bundleError) {
    return badRequest(bundleError);
  }

  const artifactError = validateArtifactSize(parsed.data.artifact);
  if (artifactError) {
    return badRequest(artifactError);
  }

  const expectedBundleHash = await sha256Hex(
    stableBundlePayload(parsed.data.bundle)
  );
  if (expectedBundleHash !== parsed.data.bundleHash) {
    return badRequest('bundleHash does not match bundle contents');
  }

  const expectedContentHash = await hashPublishArtifact(parsed.data.artifact);
  if (expectedContentHash !== parsed.data.contentHash.toLowerCase()) {
    return badRequest('contentHash does not match artifact contents');
  }

  const [packageRow] = await database
    .select()
    .from(pkg)
    .where(eq(pkg.id, parsed.data.packageId))
    .limit(1);

  if (!packageRow) {
    return new Response('Not Found', { status: 404 });
  }

  if (!(await canPublishPackage(database, auth.userId, packageRow))) {
    return new Response('Not Found', { status: 404 });
  }

  const handle = await publicHandleForPackage(database, packageRow);
  if (!handle) {
    return new Response('Scope handle not found', { status: 500 });
  }

  const contentHash = parsed.data.contentHash.toLowerCase();
  const artifactKey = artifactObjectKey(contentHash, 'bundle.mjs').replace(
    /\/bundle\.mjs$/u,
    ''
  );

  try {
    await Promise.all([
      ctx.artifacts.put(
        artifactObjectKey(contentHash, 'bundle.mjs'),
        parsed.data.artifact.bundle
      ),
      ctx.artifacts.put(
        artifactObjectKey(contentHash, 'bundle.mjs.map'),
        parsed.data.artifact.sourceMap
      ),
      ctx.artifacts.put(
        artifactObjectKey(contentHash, 'manifest.json'),
        parsed.data.artifact.manifestJson
      ),
      ctx.artifacts.put(
        artifactObjectKey(contentHash, 'build.json'),
        parsed.data.artifact.buildJson
      ),
    ]);
  } catch {
    return new Response('Artifact storage failed; retry finalize', {
      status: 503,
    });
  }

  const kvKey = bundleKvKey(parsed.data.bundleHash);
  const kvPayload = JSON.stringify({
    mainModule: parsed.data.bundle.mainModule,
    modules: parsed.data.bundle.modules,
  });

  try {
    await ctx.bundles.put(kvKey, kvPayload);
  } catch {
    return new Response('Bundle storage failed; retry finalize', {
      status: 503,
    });
  }

  const previousVersions = await database
    .select({ semver: packageVersion.semver })
    .from(packageVersion)
    .where(eq(packageVersion.packageId, packageRow.id));
  const nextSemver = bumpSemver(
    highestSemver(previousVersions.map((row) => row.semver)),
    parsed.data.bump ?? 'patch'
  );

  const preparedFunctions = parsed.data.contracts.map((fn) => {
    const contractRecord = fn.contract as Record<string, unknown>;
    const searchText = buildFunctionSearchText({
      contract: contractRecord,
      slug: fn.slug,
    });
    return { fn, searchText };
  });

  let version;
  try {
    version = await database.transaction(async (tx) => {
      const [insertedVersion] = await tx
        .insert(packageVersion)
        .values({
          artifactKey,
          bundleHash: parsed.data.bundleHash,
          contracts: parsed.data.contracts,
          createdBy: auth.userId,
          gitDirty: parsed.data.gitDirty ?? false,
          gitSha: parsed.data.gitSha?.toLowerCase() ?? null,
          packageId: packageRow.id,
          runtimeVersion: WORKER_COMPATIBILITY_DATE,
          semver: nextSemver,
          sourceHash: parsed.data.sourceHash.toLowerCase(),
        })
        .returning();

      if (!insertedVersion) {
        throw new Error('Failed to create package version');
      }

      const deployedSlugs = parsed.data.contracts.map((fn) => fn.slug);

      await Promise.all(
        preparedFunctions.map((row) => {
          const { fn } = row;
          return tx
            .insert(pkgFunction)
            .values({
              contract: fn.contract,
              exportName: fn.exportName,
              packageId: packageRow.id,
              path: fn.path,
              searchText: row.searchText,
              slug: fn.slug,
            })
            .onConflictDoUpdate({
              set: {
                contract: fn.contract,
                exportName: fn.exportName,
                path: fn.path,
                searchText: row.searchText,
                updatedAt: new Date(),
              },
              target: [pkgFunction.packageId, pkgFunction.slug],
            });
        })
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

  try {
    await syncPackageToHot(ctx.hot, database, packageRow.id);
  } catch {
    // HOT is best-effort; Postgres remains source of truth
  }

  return json({
    artifactKey,
    bundleHash: parsed.data.bundleHash,
    bundleKvKey: kvKey.replace(BUNDLE_KV_PREFIX, ''),
    currentVersionId: version.id,
    functions: parsed.data.contracts.map((fn) => ({ slug: fn.slug })),
    handle,
    packageId: packageRow.id,
    semver: version.semver,
    slug: packageRow.slug,
    versionId: version.id,
  });
};

export const handlePublishRollback = async (
  request: Request,
  ctx: PublishHandlerContext
): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const database = ctx.db;
  const auth = await ctx.authenticatePublish(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const parsed = publishRollbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  let packageRow: typeof pkg.$inferSelect | undefined;
  if (parsed.data.packageId) {
    const [row] = await database
      .select()
      .from(pkg)
      .where(eq(pkg.id, parsed.data.packageId))
      .limit(1);
    packageRow = row;
  } else if (parsed.data.slug) {
    const sharing = await resolvePublishSharingForPublishStart(
      database,
      auth.userId,
      { scope: parsed.data.scope },
      null
    );
    if (!sharing.ok) {
      return badRequest(sharing.error);
    }
    packageRow = await findPackageForIdentity(
      database,
      parsed.data.slug,
      sharing.value.organizationId
    );
  }

  if (!packageRow) {
    return new Response('Not Found', { status: 404 });
  }

  if (!(await canPublishPackage(database, auth.userId, packageRow))) {
    return new Response('Not Found', { status: 404 });
  }

  const [version] = await database
    .select()
    .from(packageVersion)
    .where(
      and(
        eq(packageVersion.packageId, packageRow.id),
        eq(packageVersion.semver, parsed.data.semver)
      )
    )
    .limit(1);

  if (!version) {
    return badRequest(`Unknown version ${parsed.data.semver}`);
  }

  await database
    .update(pkg)
    .set({ currentVersionId: version.id })
    .where(eq(pkg.id, packageRow.id));

  const handle = await publicHandleForPackage(database, packageRow);
  if (!handle) {
    return new Response('Scope handle not found', { status: 500 });
  }

  try {
    await syncPackageToHot(ctx.hot, database, packageRow.id);
  } catch {
    // HOT is best-effort; Postgres remains source of truth
  }

  return json({
    currentVersionId: version.id,
    handle,
    packageId: packageRow.id,
    semver: version.semver,
    slug: packageRow.slug,
  });
};
