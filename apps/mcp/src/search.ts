import { createDb } from '@functhis/db';
import { user } from '@functhis/db/schema/auth';
import { pkg, pkgFunction } from '@functhis/db/schema/catalog';
import { formatFunctionId } from '@functhis/deploy';
import { and, eq, ilike, isNotNull, or, sql } from 'drizzle-orm';

export type SearchDomain = 'library' | 'mine' | 'org';

export interface SearchHit {
  contract: unknown;
  id: string;
}

const SEARCH_LIMIT = 25;

export class UnsupportedSearchDomainError extends Error {
  readonly domain: SearchDomain;

  constructor(domain: SearchDomain) {
    super(`Search domain "${domain}" is not available yet`);
    this.name = 'UnsupportedSearchDomainError';
    this.domain = domain;
  }
}

export const assertSearchDomain = (domain?: SearchDomain): 'mine' => {
  if (domain !== undefined && domain !== 'mine') {
    throw new UnsupportedSearchDomainError(domain);
  }
  return 'mine';
};

export const searchMine = async (
  env: Env,
  input: {
    callerUserId: string;
    domain?: SearchDomain;
    query?: string;
  }
): Promise<SearchHit[]> => {
  assertSearchDomain(input.domain);

  const database = await createDb(env);
  const trimmedQuery = input.query?.trim() ?? '';

  const ownerFilter = and(
    eq(pkg.ownerUserId, input.callerUserId),
    isNotNull(pkg.currentVersionId)
  );

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
    .where(
      trimmedQuery.length === 0
        ? ownerFilter
        : and(
            ownerFilter,
            or(
              ilike(user.handle, `%${trimmedQuery}%`),
              ilike(pkg.slug, `%${trimmedQuery}%`),
              ilike(pkgFunction.slug, `%${trimmedQuery}%`),
              ilike(
                sql<string>`${pkgFunction.contract}->>'description'`,
                `%${trimmedQuery}%`
              )
            )
          )
    )
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
