import type { Database } from '@functhis/db';
import { member, organization } from '@functhis/db/schema/auth';
import { pkg } from '@functhis/db/schema/catalog';
import { and, eq } from 'drizzle-orm';

import type { PackageVisibility } from './catalog-access';
import { getPackageBySlugs } from './catalog-read';

export interface DeploySharingInput {
  organizationSlug?: string;
  visibility?: PackageVisibility;
}

export interface ResolvedDeploySharing {
  organizationId: string | null;
  visibility: PackageVisibility;
}

export type ResolveDeploySharingResult =
  | { ok: true; value: ResolvedDeploySharing }
  | { ok: false; error: string };

export interface ExistingPackageSharing {
  organizationId: string | null;
  visibility: PackageVisibility;
}

export const hasDeploySharingInput = (input: DeploySharingInput): boolean =>
  input.visibility !== undefined || input.organizationSlug !== undefined;

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

export const resolveDeploySharing = async (
  database: Database,
  userId: string,
  input: DeploySharingInput
): Promise<ResolveDeploySharingResult> => {
  const visibility = input.visibility ?? 'private';

  if (visibility === 'organization' && !input.organizationSlug) {
    return {
      error: 'organizationSlug is required when visibility is organization',
      ok: false,
    };
  }

  let organizationId: string | null = null;
  if (input.organizationSlug) {
    organizationId = await resolveOrganizationIdForMember(
      database,
      userId,
      input.organizationSlug
    );
    if (!organizationId) {
      return {
        error: 'Organization not found or you are not a member',
        ok: false,
      };
    }
  }

  if (visibility === 'private' || visibility === 'library') {
    organizationId = input.organizationSlug ? organizationId : null;
  }

  return {
    ok: true,
    value: { organizationId, visibility },
  };
};

/** Apply deploy/start sharing: new packages default to private; redeploy preserves DB values unless flags are sent. */
export const resolveDeploySharingForDeployStart = (
  database: Database,
  userId: string,
  input: DeploySharingInput,
  existing: ExistingPackageSharing | null
): Promise<ResolveDeploySharingResult> => {
  if (existing && !hasDeploySharingInput(input)) {
    return Promise.resolve({
      ok: true,
      value: {
        organizationId: existing.organizationId,
        visibility: existing.visibility,
      },
    });
  }

  const effectiveInput: DeploySharingInput = existing
    ? {
        organizationSlug: input.organizationSlug,
        visibility: input.visibility ?? existing.visibility,
      }
    : input;

  return resolveDeploySharing(database, userId, effectiveInput);
};

export const updatePackageSharing = async (
  database: Database,
  userId: string,
  handle: string,
  packageSlug: string,
  input: DeploySharingInput
): Promise<{ ok: true } | { error: string; ok: false }> => {
  const catalog = await getPackageBySlugs(database, handle, packageSlug);
  if (!catalog || catalog.ownerUserId !== userId) {
    return { error: 'Package not found', ok: false };
  }

  const sharing = await resolveDeploySharing(database, userId, input);
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
