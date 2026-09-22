import { createDb } from '@functhis/db';
import { user } from '@functhis/db/schema/auth';
import { pkg, pkgFunction } from '@functhis/db/schema/catalog';
import { embeddingDriverLiteral } from '@functhis/db/schema/vector';
import {
  embedSearchQuery,
  formatFunctionId,
  listMembershipOrganizationIds,
} from '@functhis/deploy';
import { and, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';

import {
  isExactSearchMatch,
  rankSearchCandidates,
  VECTOR_SIMILARITY_CUTOFF,
} from './search-ranking';
import type { SearchCandidateRow } from './search-ranking';

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
    ilike(pkgFunction.searchText, `%${trimmedQuery}%`),
    ilike(
      sql<string>`${pkgFunction.contract}->>'description'`,
      `%${trimmedQuery}%`
    )
  );

const baseFilterForDomain = async (
  database: Awaited<ReturnType<typeof createDb>>,
  domain: SearchDomain,
  callerUserId: string
) => {
  if (domain === 'mine') {
    return and(
      eq(pkg.ownerUserId, callerUserId),
      isNotNull(pkg.currentVersionId)
    );
  }
  if (domain === 'library') {
    return and(eq(pkg.visibility, 'library'), isNotNull(pkg.currentVersionId));
  }
  const organizationIds = await listMembershipOrganizationIds(
    database,
    callerUserId
  );
  if (organizationIds.length === 0) {
    return null;
  }
  return and(
    inArray(pkg.organizationId, organizationIds),
    eq(pkg.visibility, 'organization'),
    isNotNull(pkg.currentVersionId)
  );
};

interface FunctionSearchRow {
  contract: unknown;
  functionSlug: string;
  handle: string;
  packageSlug: string;
}

const selectFunctionRows = (
  database: Awaited<ReturnType<typeof createDb>>,
  whereClause: ReturnType<typeof and>
) =>
  database
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

const toSearchHit = (row: FunctionSearchRow): SearchHit => ({
  contract: row.contract,
  id: formatFunctionId({
    functionSlug: row.functionSlug,
    handle: row.handle,
    packageSlug: row.packageSlug,
  }),
});

export const searchFunctions = async (
  env: Env,
  input: {
    callerUserId: string;
    domain?: SearchDomain;
    query?: string;
  }
): Promise<SearchHit[]> => {
  const database = await createDb(env);
  const domain = normalizeSearchDomain(input.domain);
  const trimmedQuery = input.query?.trim() ?? '';
  const baseFilter = await baseFilterForDomain(
    database,
    domain,
    input.callerUserId
  );
  if (!baseFilter) {
    return [];
  }

  if (trimmedQuery.length === 0) {
    const rows = await selectFunctionRows(database, baseFilter);
    return rows.map(toSearchHit);
  }

  const ai =
    env.AI === undefined ? undefined : { run: env.AI.run.bind(env.AI) };

  const [textRows, queryVector] = await Promise.all([
    selectFunctionRows(
      database,
      and(baseFilter, textQueryFilter(trimmedQuery))
    ),
    ai === undefined
      ? Promise.resolve(null)
      : embedSearchQuery(ai, trimmedQuery),
  ]);

  let vectorRows: (FunctionSearchRow & { distance: number })[] = [];
  const vectorLiteral = queryVector
    ? embeddingDriverLiteral(queryVector)
    : null;
  if (vectorLiteral) {
    try {
      const distanceExpr = sql<number>`${pkgFunction.embedding} <=> CAST(${vectorLiteral} AS vector)`;
      vectorRows = await database
        .select({
          contract: pkgFunction.contract,
          distance: distanceExpr,
          functionSlug: pkgFunction.slug,
          handle: user.handle,
          packageSlug: pkg.slug,
        })
        .from(pkgFunction)
        .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
        .innerJoin(user, eq(pkg.ownerUserId, user.id))
        .where(
          and(
            baseFilter,
            isNotNull(pkgFunction.embedding),
            sql`${distanceExpr} < ${VECTOR_SIMILARITY_CUTOFF}`
          )
        )
        .orderBy(distanceExpr)
        .limit(SEARCH_LIMIT);
    } catch {
      vectorRows = [];
    }
  }

  const candidateMap = new Map<string, SearchCandidateRow>();
  const addCandidate = (
    row: FunctionSearchRow & { distance?: number | null }
  ) => {
    const key = `${row.handle}/${row.packageSlug}/${row.functionSlug}`;
    const existing = candidateMap.get(key);
    const exactMatch = isExactSearchMatch(trimmedQuery, row);
    const distance = row.distance ?? existing?.distance ?? null;
    candidateMap.set(key, {
      contract: row.contract,
      distance,
      exactMatch: exactMatch || existing?.exactMatch === true,
      functionSlug: row.functionSlug,
      handle: row.handle,
      packageSlug: row.packageSlug,
    });
  };

  for (const row of textRows) {
    addCandidate(row);
  }
  for (const row of vectorRows) {
    addCandidate(row);
  }

  return rankSearchCandidates([...candidateMap.values()], SEARCH_LIMIT).map(
    toSearchHit
  );
};
