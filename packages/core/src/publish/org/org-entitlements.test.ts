import { describe, expect, test } from 'bun:test';

import type { PackageVisibility } from '../catalog/catalog-access';
import type {
  ExecutionQuotaPort,
  PackageRecord,
  PackageStorePort,
} from '../ports';
import {
  assertOrgCanAddPackage,
  countOrgPackages,
  TRIAL_ORG_LIMITS,
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

const quota = (
  overrides: Partial<ExecutionQuotaPort> = {}
): ExecutionQuotaPort => ({
  countPackages: () => Promise.resolve(0),
  readActiveSubscription: () => Promise.resolve(null),
  readExecutionCount: () => Promise.resolve(0),
  tryReserve: () => Promise.resolve('reserved' as const),
  ...overrides,
});

describe('limitsForPlan', () => {
  test('returns developer limits for the pro plan alias', () => {
    expect(limitsForPlan('pro').maxPackages).toBeGreaterThan(
      TRIAL_ORG_LIMITS.maxPackages
    );
  });
});

describe('resolveOrgPlan', () => {
  test('defaults to free without subscription row', async () => {
    await expect(resolveOrgPlan(quota(), 'org-1')).resolves.toBe('trial');
  });

  test('returns developer for active pro subscription', async () => {
    await expect(
      resolveOrgPlan(
        quota({
          readActiveSubscription: () =>
            Promise.resolve({
              plan: 'pro',
              status: 'active',
            }),
        }),
        'org-1'
      )
    ).resolves.toBe('developer');
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
    await expect(readOrgExecutionCount(quota(), 'org-1')).resolves.toBe(0);
  });
});

describe('countOrgPackages and assertOrgCanAddPackage', () => {
  test('countOrgPackages reads aggregate', async () => {
    await expect(
      countOrgPackages(
        quota({ countPackages: () => Promise.resolve(2) }),
        'org-1'
      )
    ).resolves.toBe(2);
  });

  test('assertOrgCanAddPackage passes under cap', async () => {
    await expect(
      assertOrgCanAddPackage(quota(), 'org-1')
    ).resolves.toBeUndefined();
  });

  test('insertOrgPackageIfUnderLimit calls package store', async () => {
    const inserted: PackageRecord = {
      currentVersionId: null,
      id: 'pkg-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      slug: 'demo',
      sourceKind: 'hosted_function',
      visibility: 'private',
    };
    const packages: PackageStorePort = {
      commitVersion: () => Promise.resolve({ id: 'v1', semver: '0.0.1' }),
      findById: () => Promise.resolve(null),
      findByOrgAndSlug: () => Promise.resolve(null),
      findOwnedBySlug: () => Promise.resolve(null),
      findVersion: () => Promise.resolve(null),
      insertIfUnderLimit: (values, decide) =>
        Promise.resolve(decide(0)).then(() => {
          void values;
          return inserted;
        }),
      listSemvers: () => Promise.resolve([]),
      publicHandle: () => Promise.resolve('acme'),
      setCurrentVersion: () => Promise.resolve(),
      setPackageVisibility: () => Promise.resolve(),
      setVisibility: () => Promise.resolve(),
    };
    await expect(
      insertOrgPackageIfUnderLimit(packages, quota(), {
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        slug: 'demo',
        visibility: 'private' as PackageVisibility,
      })
    ).resolves.toEqual(inserted);
  });

  test('assertOrgCanAddPackage throws when at cap', async () => {
    await expect(
      assertOrgCanAddPackage(
        quota({
          countPackages: () =>
            Promise.resolve(TRIAL_ORG_LIMITS.maxPackages ?? 999),
        }),
        'org-1'
      )
    ).rejects.toBeInstanceOf(OrgQuotaExceededError);
  });
});

describe('reserveOrgExecution', () => {
  test('passes when quota reserves', async () => {
    await expect(
      reserveOrgExecution(quota(), 'org-1')
    ).resolves.toBeUndefined();
  });

  test('throws when execution count is at the monthly cap', async () => {
    await expect(
      reserveOrgExecution(
        quota({
          readActiveSubscription: () =>
            Promise.resolve({
              plan: 'trial',
              status: 'active',
            }),
          tryReserve: () => Promise.resolve('full' as const),
        }),
        'org-1'
      )
    ).rejects.toBeInstanceOf(OrgQuotaExceededError);
  });
});
