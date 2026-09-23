import type { Database } from '@functhis/db';
import { member, organization, user } from '@functhis/db/schema/auth';
import { pkg } from '@functhis/db/schema/catalog';
import { and, eq } from 'drizzle-orm';

import type { PackageVisibility } from './catalog-access';
import { getPackageBySlugs } from './catalog-read';

export interface PublishSharingInput {
  organizationSlug?: string;
  scope?: string;
  visibility?: PackageVisibility;
}

export interface ResolvedPublishSharing {
  organizationId: string | null;
  scopeKind: 'organization' | 'user';
  visibility: PackageVisibility;
}

export type ResolvePublishSharingResult =
  | { ok: true; value: ResolvedPublishSharing }
  | { ok: false; error: string };

export interface ExistingPackageSharing {
  organizationId: string | null;
  scopeKind: 'organization' | 'user';
  visibility: PackageVisibility;
}

export const hasPublishSharingInput = (input: PublishSharingInput): boolean =>
  input.visibility !== undefined ||
  input.organizationSlug !== undefined ||
  input.scope !== undefined;

export const resolveOrganizationIdForMember = async (
  database: Database,
  userId: string,
  organizationSlug: string
): Promise<string | null> => {
  const [row] = await database
    .select({ id: organization.id })
    .from(organization)
    .innerJoin(member, eq(member.organizationId, organization.id))
    .where(
      and(eq(organization.slug, organizationSlug), eq(member.userId, userId))
    )
    .limit(1);

  return row?.id ?? null;
};

export const resolveOrganizationSlugById = async (
  database: Database,
  organizationId: string
): Promise<string | null> => {
  const [row] = await database
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  return row?.slug ?? null;
};

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

  if (visibility === 'organization' && !scopeHandle) {
    return {
      error: 'scope is required when visibility is organization',
      ok: false,
    };
  }

  if (!scopeHandle) {
    return {
      ok: true,
      value: { organizationId: null, scopeKind: 'user', visibility },
    };
  }

  const [owner] = await database
    .select({ handle: user.handle })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (owner?.handle === scopeHandle) {
    return {
      ok: true,
      value: { organizationId: null, scopeKind: 'user', visibility },
    };
  }

  const organizationId = await resolveOrganizationIdForMember(
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

  return {
    ok: true,
    value: {
      organizationId,
      scopeKind: 'organization',
      visibility: visibility === 'organization' ? 'private' : visibility,
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
        scopeKind: existing.scopeKind,
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
        scopeKind: existing.scopeKind,
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

  const sharing = await resolvePublishSharing(database, userId, input);
  if (!sharing.ok) {
    return { error: sharing.error, ok: false };
  }

  await database
    .update(pkg)
    .set({
      organizationId: sharing.value.organizationId,
      visibility: sharing.value.visibility,
    })
    .where(and(eq(pkg.id, catalog.id), eq(pkg.ownerUserId, userId)));

  return { ok: true };
};
