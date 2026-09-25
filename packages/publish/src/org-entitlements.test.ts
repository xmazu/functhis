import { describe, expect, test } from 'bun:test';

import {
  assertOrgCanAddPackage,
  countOrgPackages,
  FREE_ORG_LIMITS,
  insertOrgPackageIfUnderLimit,
  limitsForPlan,
  OrgQuotaExceededError,
  resolveOrgPlan,
} from './org-entitlements';
import {
  currentUsagePeriodKey,
  readOrgExecutionCount,
  reserveOrgExecution,
} from './org-usage';

describe('limitsForPlan', () => {
  test('returns pro limits for pro', () => {
    expect(limitsForPlan('pro').maxPackages).toBeGreaterThan(
      FREE_ORG_LIMITS.maxPackages
    );
  });
});

describe('resolveOrgPlan', () => {
  test('defaults to free without subscription row', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    };
    await expect(resolveOrgPlan(database as never, 'org-1')).resolves.toBe(
      'free'
    );
  });

  test('returns pro for active pro subscription', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ plan: 'pro', status: 'active' }]),
            }),
          }),
        }),
      }),
    };
    await expect(resolveOrgPlan(database as never, 'org-1')).resolves.toBe(
      'pro'
    );
  });
});

describe('OrgQuotaExceededError', () => {
  test('stores code and plan', () => {
    const error = new OrgQuotaExceededError(
      'package_limit',
      'org-1',
      'free',
      'limit'
    );
    expect(error.code).toBe('package_limit');
    expect(error.plan).toBe('free');
  });
});

describe('org usage period key', () => {
  test('formats UTC month', () => {
    expect(currentUsagePeriodKey(new Date('2026-09-15T12:00:00Z'))).toBe(
      '2026-09'
    );
  });

  test('readOrgExecutionCount returns zero when missing', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    };
    await expect(
      readOrgExecutionCount(database as never, 'org-1')
    ).resolves.toBe(0);
  });
});

describe('countOrgPackages and assertOrgCanAddPackage', () => {
  test('countOrgPackages reads aggregate', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([{ value: 2 }]),
        }),
      }),
    };
    await expect(countOrgPackages(database as never, 'org-1')).resolves.toBe(2);
  });

  test('assertOrgCanAddPackage passes under cap', async () => {
    let selectCalls = 0;
    const database = {
      select: () => {
        selectCalls += 1;
        if (selectCalls === 1) {
          return {
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => Promise.resolve([]),
                }),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () => Promise.resolve([{ value: 0 }]),
          }),
        };
      },
    };
    await expect(
      assertOrgCanAddPackage(database as never, 'org-1')
    ).resolves.toBeUndefined();
  });

  test('insertOrgPackageIfUnderLimit locks and inserts under cap', async () => {
    let selectCalls = 0;
    let executedLock = false;
    const insertedRow = {
      id: 'pkg-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      slug: 'demo',
      visibility: 'private' as const,
    };
    const database = {
      transaction: (handler: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          execute: () => {
            executedLock = true;
            return Promise.resolve();
          },
          insert: () => ({
            values: () => ({
              returning: () => Promise.resolve([insertedRow]),
            }),
          }),
          select: () => {
            selectCalls += 1;
            if (selectCalls === 1) {
              return {
                from: () => ({
                  where: () => ({
                    orderBy: () => ({
                      limit: () => Promise.resolve([]),
                    }),
                  }),
                }),
              };
            }
            return {
              from: () => ({
                where: () => Promise.resolve([{ value: 0 }]),
              }),
            };
          },
        };
        return handler(tx);
      },
    };
    await expect(
      insertOrgPackageIfUnderLimit(database as never, {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        slug: 'demo',
        visibility: 'private',
      })
    ).resolves.toEqual(insertedRow);
    expect(executedLock).toBe(true);
    expect(selectCalls).toBeGreaterThan(0);
  });

  test('assertOrgCanAddPackage throws when at cap', async () => {
    let selectCalls = 0;
    const database = {
      select: () => {
        selectCalls += 1;
        if (selectCalls === 1) {
          return {
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => Promise.resolve([]),
                }),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () =>
              Promise.resolve([{ value: FREE_ORG_LIMITS.maxPackages }]),
          }),
        };
      },
    };
    await expect(
      assertOrgCanAddPackage(database as never, 'org-1')
    ).rejects.toBeInstanceOf(OrgQuotaExceededError);
  });
});

describe('reserveOrgExecution', () => {
  test('updates when period row exists', async () => {
    let updated = false;
    const database = {
      insert: () => ({
        values: () => Promise.resolve(),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
            orderBy: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => {
              updated = true;
              return Promise.resolve([{ executionCount: 2 }]);
            },
          }),
        }),
      }),
    };
    await reserveOrgExecution(database as never, 'org-1');
    expect(updated).toBe(true);
  });

  test('inserts first execution in period', async () => {
    const inserts: unknown[] = [];
    let selectCalls = 0;
    const database = {
      insert: () => ({
        values: (row: unknown) => {
          inserts.push(row);
          return Promise.resolve();
        },
      }),
      select: () => {
        selectCalls += 1;
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve(
                  selectCalls === 1 ? [] : [{ executionCount: 0 }]
                ),
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        };
      },
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([]),
          }),
        }),
      }),
    };
    await reserveOrgExecution(database as never, 'org-1');
    expect(inserts).toHaveLength(1);
  });

  test('throws when execution count is at the monthly cap', async () => {
    const database = {
      insert: () => ({
        values: () => Promise.resolve(),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ executionCount: 1000 }]),
            orderBy: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([]),
          }),
        }),
      }),
    };
    await expect(
      reserveOrgExecution(database as never, 'org-1')
    ).rejects.toBeInstanceOf(OrgQuotaExceededError);
  });

  test('retries after a concurrent insert wins the period row', async () => {
    let updateCalls = 0;
    const database = {
      insert: () => ({
        values: () =>
          Promise.reject(
            Object.assign(new Error('unique violation'), { code: '23505' })
          ),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ executionCount: 0 }]),
            orderBy: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => {
              updateCalls += 1;
              return Promise.resolve(
                updateCalls === 1 ? [] : [{ executionCount: 1 }]
              );
            },
          }),
        }),
      }),
    };
    await reserveOrgExecution(database as never, 'org-1');
    expect(updateCalls).toBe(2);
  });
});
