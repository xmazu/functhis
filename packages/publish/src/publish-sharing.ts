import type { Database } from '@functhis/db';
import { pkg } from '@functhis/db/schema/catalog';
import { and, eq } from 'drizzle-orm';

import type { PackageVisibility } from './catalog-access';
import { getPackageBySlugs } from './catalog-read';
import {
  listMemberOrganizations,
  resolveOrganizationIdForMember,
} from './org-membership-read';

export interface PublishSharingInput {
  organizationSlug?: string;
  scope?: string;
  visibility?: PackageVisibility;
}

export interface ResolvedPublishSharing {
  organizationId: string;
  visibility: PackageVisibility;
}

export type ResolvePublishSharingResult =
  | { ok: true; value: ResolvedPublishSharing }
  | { ok: false; error: string };

export interface ExistingPackageSharing {
  organizationId: string;
  visibility: PackageVisibility;
}

export const WORKSPACE_SETUP_URL = 'https://functhis.now/d/onboard';

export const hasPublishSharingInput = (input: PublishSharingInput): boolean =>
  input.visibility !== undefined ||
  input.organizationSlug !== undefined ||
  input.scope !== undefined;

export const resolveScopeHandle = (
  input: PublishSharingInput
): string | undefined => input.scope ?? input.organizationSlug;

export const resolvePublishSharing = async (
  database: Database,
  userId: string,
  input: PublishSharingInput
): Promise<ResolvePublishSharingResult> => {
  const visibility = input.visibility ?? 'private';
  const scopeHandle = resolveScopeHandle(input);

  let organizationId: string | null = null;

  if (scopeHandle) {
    organizationId = await resolveOrganizationIdForMember(
      database,
      userId,
      scopeHandle
    );
    if (!organizationId) {
      return {
        error: 'Scope not found or you are not a member',
        ok: false,
      };
    }
  } else {
    const organizations = await listMemberOrganizations(database, userId);
    if (organizations.length === 0) {
      return {
        error: `Create a workspace at ${WORKSPACE_SETUP_URL} before publishing`,
        ok: false,
      };
    }
    if (organizations.length > 1) {
      return {
        error: 'Multiple organizations: pass --scope <org-slug>',
        ok: false,
      };
    }
    organizationId = organizations[0]?.id ?? null;
  }

  if (!organizationId) {
    return {
      error: `Create a workspace at ${WORKSPACE_SETUP_URL} before publishing`,
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      organizationId,
      visibility,
    },
  };
};

/** Apply publish/start sharing: new packages default to private; republish preserves DB values unless flags are sent. */
export const resolvePublishSharingForPublishStart = (
  database: Database,
  userId: string,
  input: PublishSharingInput,
  existing: ExistingPackageSharing | null
): Promise<ResolvePublishSharingResult> => {
  if (existing && !hasPublishSharingInput(input)) {
    return Promise.resolve({
      ok: true,
      value: {
        organizationId: existing.organizationId,
        visibility: existing.visibility,
      },
    });
  }

  if (
    existing &&
    input.scope === undefined &&
    input.organizationSlug === undefined
  ) {
    return Promise.resolve({
      ok: true,
      value: {
        organizationId: existing.organizationId,
        visibility: input.visibility ?? existing.visibility,
      },
    });
  }

  const effectiveInput: PublishSharingInput = existing
    ? {
        organizationSlug: input.organizationSlug,
        scope: input.scope,
        visibility: input.visibility ?? existing.visibility,
      }
    : input;

  return resolvePublishSharing(database, userId, effectiveInput);
};

/** Single sharing resolution for publish/start (avoids duplicate preview + final calls). */
export const resolvePublishStartSharing = (
  database: Database,
  userId: string,
  input: PublishSharingInput,
  ownedPackage: ExistingPackageSharing | null,
  orgPackageInTargetOrg: ExistingPackageSharing | null
): Promise<ResolvePublishSharingResult> => {
  if (ownedPackage) {
    return resolvePublishSharingForPublishStart(
      database,
      userId,
      input,
      ownedPackage
    );
  }

  if (orgPackageInTargetOrg) {
    return resolvePublishSharingForPublishStart(
      database,
      userId,
      input,
      orgPackageInTargetOrg
    );
  }

  return resolvePublishSharingForPublishStart(database, userId, input, null);
};

export const updatePackageSharing = async (
  database: Database,
  userId: string,
  handle: string,
  packageSlug: string,
  input: PublishSharingInput
): Promise<{ ok: true } | { error: string; ok: false }> => {
  const catalog = await getPackageBySlugs(database, handle, packageSlug);
  if (!catalog || catalog.ownerUserId !== userId) {
    return { error: 'Package not found', ok: false };
  }

  const sharing = await resolvePublishSharing(database, userId, {
    ...input,
    scope: input.scope ?? handle,
  });
  if (!sharing.ok) {
    return { error: sharing.error, ok: false };
  }

  if (sharing.value.organizationId !== catalog.organizationId) {
    return { error: 'Cannot change package organization', ok: false };
  }

  await database
    .update(pkg)
    .set({
      visibility: sharing.value.visibility,
    })
    .where(and(eq(pkg.id, catalog.id), eq(pkg.ownerUserId, userId)));

  return { ok: true };
};
