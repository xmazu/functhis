import { createDb } from '@functhis/db';
import { user } from '@functhis/db/schema/auth';
import { pkg, pkgFunction } from '@functhis/db/schema/catalog';
import {
  formatFunctionId,
  listMembershipOrganizationIds,
} from '@functhis/deploy';
import { and, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';

export type SearchDomain = 'library' | 'mine' | 'org';

export interface SearchHit {
  contract: unknown;
  id: string;
}

const SEARCH_LIMIT = 25;

export const normalizeSearchDomain = (domain?: SearchDomain): SearchDomain =>
  domain ?? 'mine';

const textQueryFilter = (trimmedQuery: string) =>
  or(
    ilike(user.handle, `%${trimmedQuery}%`),
    ilike(pkg.slug, `%${trimmedQuery}%`),
    ilike(pkgFunction.slug, `%${trimmedQuery}%`),
    ilike(
      sql<string>`${pkgFunction.contract}->>'description'`,
      `%${trimmedQuery}%`
    )
  );

export const searchFunctions = async (
  env: Env,
  input: {
    callerUserId: string;
    domain?: SearchDomain;
    query?: string;
  }
): Promise<SearchHit[]> => {
  const domain = normalizeSearchDomain(input.domain);
  const database = await createDb(env);
  const trimmedQuery = input.query?.trim() ?? '';

  let baseFilter;
  if (domain === 'mine') {
    baseFilter = and(
      eq(pkg.ownerUserId, input.callerUserId),
      isNotNull(pkg.currentVersionId)
    );
  } else if (domain === 'library') {
    baseFilter = and(
      eq(pkg.visibility, 'library'),
      isNotNull(pkg.currentVersionId)
    );
  } else {
    const organizationIds = await listMembershipOrganizationIds(
      database,
      input.callerUserId
    );
    if (organizationIds.length === 0) {
      return [];
    }
    baseFilter = and(
      inArray(pkg.organizationId, organizationIds),
      eq(pkg.visibility, 'organization'),
      isNotNull(pkg.currentVersionId)
    );
  }

  const whereClause =
    trimmedQuery.length === 0
      ? baseFilter
      : and(baseFilter, textQueryFilter(trimmedQuery));

  const rows = await database
    .select({
      contract: pkgFunction.contract,
      functionSlug: pkgFunction.slug,
      handle: user.handle,
      packageSlug: pkg.slug,
    })
    .from(pkgFunction)
    .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
    .innerJoin(user, eq(pkg.ownerUserId, user.id))
    .where(whereClause)
    .limit(SEARCH_LIMIT);

  return rows.map((row) => ({
    contract: row.contract,
    id: formatFunctionId({
      functionSlug: row.functionSlug,
      handle: row.handle,
      packageSlug: row.packageSlug,
    }),
  }));
};
