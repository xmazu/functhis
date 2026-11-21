import type { z } from 'zod';

import { artifactObjectKey, hashPublishArtifact } from '../artifact';
import type { PublishArtifact } from '../artifact';
import {
  bundleKvKey,
  sha256Hex,
  stableBundlePayload,
  utf8ByteLength,
} from '../bundle';
import { syncPackageToHot } from '../catalog/hot-catalog';
import { projectHotDocsForSearch } from '../catalog/hot-search-projection';
import {
  resolvePublishSharingForPublishStart,
  resolvePublishStartSharing,
} from '../catalog/publish-sharing';
import type { ExistingPackageSharing } from '../catalog/publish-sharing';
import {
  BUNDLE_KV_PREFIX,
  MAX_ARTIFACT_BYTES,
  MAX_BUNDLE_BYTES,
  MAX_SOURCE_MANIFEST_BYTES,
  MAX_SOURCE_MANIFEST_FILES,
} from '../constants';
import {
  OrgQuotaExceededError,
  insertOrgPackageIfUnderLimit,
} from '../org/org-entitlements';
import {
  publishFinalizeBodySchema,
  publishRollbackBodySchema,
  publishStartBodySchema,
} from '../schemas';
import type { WorkerLoaderBundle } from '../schemas';
import { buildFunctionSearchText } from '../search/function-search-text';
import { buildIntentPhrases } from '../search/search-projection';
import { canPublishPackage } from '../secrets/secret-access';
import { parseSecretNamesFromManifestJson } from '../secrets/secret-names';
import { bumpSemver, highestSemver } from '../semver';
import type { PublishHandlerContext } from './http-context';

export type { PublishHandlerContext } from './http-context';

const retryHotWrite = async <T>(
  work: () => Promise<T>,
  attempt = 0
): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (attempt >= 2) {
      throw error instanceof Error ? error : new Error('HOT write failed');
    }
    return retryHotWrite(work, attempt + 1);
  }
};

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

  const { catalog } = ctx;
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

  const ownedRow = await catalog.packages.findOwnedBySlug(
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
      catalog.memberships,
      auth.userId,
      sharingInput,
      null,
      null
    );
    if (!preview.ok) {
      return badRequest(preview.error);
    }
    const orgRow = await catalog.packages.findByOrgAndSlug(
      preview.value.organizationId,
      parsed.data.slug
    );
    if (orgRow) {
      orgPackageInTargetOrg = {
        organizationId: orgRow.organizationId,
        visibility: orgRow.visibility,
      };
    }
  }

  const sharing = await resolvePublishStartSharing(
    catalog.memberships,
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
    (await catalog.packages.findByOrgAndSlug(
      organizationId,
      parsed.data.slug
    )) ?? undefined;
  if (packageRow) {
    if (packageRow.visibility !== visibility) {
      await catalog.packages.setVisibility(packageRow.id, visibility);
      packageRow = { ...packageRow, visibility };
    }
  } else {
    try {
      packageRow = await insertOrgPackageIfUnderLimit(
        catalog.packages,
        catalog.quota,
        {
          organizationId,
          ownerUserId: auth.userId,
          slug: parsed.data.slug,
          visibility,
        }
      );
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

  const { catalog } = ctx;
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

  const packageRow = await catalog.packages.findById(parsed.data.packageId);

  if (!packageRow) {
    return new Response('Not Found', { status: 404 });
  }

  if (
    !(await canPublishPackage(catalog.memberships, auth.userId, packageRow))
  ) {
    return new Response('Not Found', { status: 404 });
  }

  const handle = await catalog.packages.publicHandle(packageRow.organizationId);
  if (!handle) {
    return new Response('Organization scope not found', { status: 500 });
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

  const previousVersions = await catalog.packages.listSemvers(packageRow.id);
  const nextSemver = bumpSemver(
    highestSemver(previousVersions),
    parsed.data.bump ?? 'patch'
  );

  const preparedFunctions = parsed.data.contracts.map((fn) => {
    const contractRecord = fn.contract as Record<string, unknown>;
    const searchText = [
      buildFunctionSearchText({
        contract: contractRecord,
        slug: fn.slug,
      }),
      ...buildIntentPhrases({
        contract: contractRecord,
        slug: fn.slug,
      }),
    ].join('\n');
    return { fn, searchText };
  });

  const deployedSlugs = parsed.data.contracts.map((fn) => fn.slug);

  let version;
  try {
    version = await catalog.packages.commitVersion({
      artifactKey,
      bundleHash: parsed.data.bundleHash,
      contracts: parsed.data.contracts,
      createdBy: auth.userId,
      deployedSlugs,
      functions: preparedFunctions.map((row) => ({
        contract: row.fn.contract,
        exportName: row.fn.exportName,
        path: row.fn.path,
        searchText: row.searchText,
        slug: row.fn.slug,
      })),
      gitDirty: parsed.data.gitDirty ?? false,
      gitSha: parsed.data.gitSha?.toLowerCase() ?? null,
      packageId: packageRow.id,
      secretNames: parseSecretNamesFromManifestJson(
        parsed.data.artifact.manifestJson
      ),
      semver: nextSemver,
      sourceHash: parsed.data.sourceHash.toLowerCase(),
    });
  } catch {
    return new Response('Failed to record package version', { status: 500 });
  }

  try {
    const docs = await retryHotWrite(() =>
      syncPackageToHot(ctx.hot, catalog.hotSource, packageRow.id)
    );
    await retryHotWrite(() => projectHotDocsForSearch(ctx.hot, docs));
  } catch {
    return new Response('Catalog projection failed; retry finalize', {
      status: 503,
    });
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

  const { catalog } = ctx;
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

  let packageRow =
    parsed.data.packageId === undefined
      ? undefined
      : await catalog.packages.findById(parsed.data.packageId);
  if (!packageRow && parsed.data.slug) {
    const sharing = await resolvePublishSharingForPublishStart(
      catalog.memberships,
      auth.userId,
      { scope: parsed.data.scope },
      null
    );
    if (!sharing.ok) {
      return badRequest(sharing.error);
    }
    packageRow =
      (await catalog.packages.findByOrgAndSlug(
        sharing.value.organizationId,
        parsed.data.slug
      )) ?? undefined;
  }

  if (!packageRow) {
    return new Response('Not Found', { status: 404 });
  }

  if (
    !(await canPublishPackage(catalog.memberships, auth.userId, packageRow))
  ) {
    return new Response('Not Found', { status: 404 });
  }

  const version = await catalog.packages.findVersion(
    packageRow.id,
    parsed.data.semver
  );

  if (!version) {
    return badRequest(`Unknown version ${parsed.data.semver}`);
  }

  await catalog.packages.setCurrentVersion(packageRow.id, version.id);

  const handle = await catalog.packages.publicHandle(packageRow.organizationId);
  if (!handle) {
    return new Response('Organization scope not found', { status: 500 });
  }

  try {
    const docs = await retryHotWrite(() =>
      syncPackageToHot(ctx.hot, catalog.hotSource, packageRow.id)
    );
    await retryHotWrite(() => projectHotDocsForSearch(ctx.hot, docs));
  } catch {
    return new Response('Catalog projection failed; retry rollback', {
      status: 503,
    });
  }

  return json({
    currentVersionId: version.id,
    handle,
    packageId: packageRow.id,
    semver: parsed.data.semver,
    slug: packageRow.slug,
  });
};
