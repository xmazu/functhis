import type { HotKvBinding } from '@functhis/core/publish';
import { memberHotKey } from '@functhis/core/publish';

import type { MembershipsPort } from '../ports';
import type { PackageAccessContext } from './catalog-access';

const putJson = async (
  hot: HotKvBinding,
  key: string,
  value: unknown
): Promise<void> => {
  await hot.put(key, JSON.stringify(value));
};

export const getMembershipOrganizationIdsFromHot = async (
  hot: HotKvBinding,
  memberships: MembershipsPort,
  userId: string
): Promise<string[]> => {
  const raw = await hot.get(memberHotKey(userId));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { organizationIds?: string[] };
      if (Array.isArray(parsed.organizationIds)) {
        return parsed.organizationIds;
      }
    } catch {
      // fall through to postgres
    }
  }
  const organizationIds = await memberships.listOrganizationIds(userId);
  await putJson(hot, memberHotKey(userId), { organizationIds });
  return organizationIds;
};

export const writeMembershipHot = async (
  hot: HotKvBinding,
  userId: string,
  organizationIds: string[]
): Promise<void> => {
  await putJson(hot, memberHotKey(userId), { organizationIds });
};

export const buildAccessContextFromHot = async (
  hot: HotKvBinding,
  memberships: MembershipsPort,
  userId: string | null
): Promise<PackageAccessContext> => {
  if (!userId) {
    return { organizationIds: [], userId: null };
  }
  const organizationIds = await getMembershipOrganizationIdsFromHot(
    hot,
    memberships,
    userId
  );
  return { organizationIds, userId };
};

export const buildAccessContextFromHotKv = async (
  hot: HotKvBinding,
  userId: string
): Promise<PackageAccessContext> => {
  const raw = await hot.get(memberHotKey(userId));
  if (!raw) {
    return { organizationIds: [], userId };
  }
  try {
    const parsed = JSON.parse(raw) as { organizationIds?: string[] };
    return {
      organizationIds: Array.isArray(parsed.organizationIds)
        ? parsed.organizationIds
        : [],
      userId,
    };
  } catch {
    return { organizationIds: [], userId };
  }
};
