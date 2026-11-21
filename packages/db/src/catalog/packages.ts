import {
  CatalogWriteError,
  PackageSlugTakenError,
} from '@functhis/core/publish/catalog-errors';
import { WORKER_COMPATIBILITY_DATE } from '@functhis/core/publish/constants';
import type {
  PackageRecord,
  PackageStorePort,
} from '@functhis/core/publish/ports';

import { and, count, eq, notInArray, sql } from '../drizzle';
import type { Database } from '../index';
import { pkg, packageVersion, pkgFunction } from '../schema/catalog';
import { resolveOrganizationSlugById } from './memberships';
import { toPackageRecord } from './package-record';

const findPackageRecord = async (
  database: Database,
  where: ReturnType<typeof eq> | ReturnType<typeof and>
): Promise<PackageRecord | null> => {
  const [row] = await database.select().from(pkg).where(where).limit(1);
  return row ? toPackageRecord(row) : null;
};

type Tx = Pick<Database, 'select' | 'insert' | 'execute'>;

const countPackagesInOrg = async (
  database: Tx,
  organizationId: string
): Promise<number> => {
  const [row] = await database
    .select({ value: count() })
    .from(pkg)
    .where(eq(pkg.organizationId, organizationId));
  return row?.value ?? 0;
};

export const createPackageStorePort = (
  database: Database
): PackageStorePort => ({
  commitVersion(input) {
    return database.transaction(async (tx) => {
      const [insertedVersion] = await tx
        .insert(packageVersion)
        .values({
          artifactKey: input.artifactKey,
          bundleHash: input.bundleHash,
          contracts: input.contracts,
          createdBy: input.createdBy,
          gitDirty: input.gitDirty,
          gitSha: input.gitSha,
          packageId: input.packageId,
          runtimeVersion: WORKER_COMPATIBILITY_DATE,
          secretNames: [...input.secretNames],
          semver: input.semver,
          sourceHash: input.sourceHash,
        })
        .returning();

      if (!insertedVersion) {
        throw new CatalogWriteError('Failed to create package version');
      }

      await Promise.all(
        input.functions.map((fn) =>
          tx
            .insert(pkgFunction)
            .values({
              contract: fn.contract,
              exportName: fn.exportName,
              packageId: input.packageId,
              path: fn.path,
              searchText: fn.searchText,
              slug: fn.slug,
            })
            .onConflictDoUpdate({
              set: {
                contract: fn.contract,
                exportName: fn.exportName,
                path: fn.path,
                searchText: fn.searchText,
                updatedAt: new Date(),
              },
              target: [pkgFunction.packageId, pkgFunction.slug],
            })
        )
      );

      await tx
        .delete(pkgFunction)
        .where(
          and(
            eq(pkgFunction.packageId, input.packageId),
            notInArray(pkgFunction.slug, [...input.deployedSlugs])
          )
        );

      await tx
        .update(pkg)
        .set({ currentVersionId: insertedVersion.id })
        .where(eq(pkg.id, input.packageId));

      return { id: insertedVersion.id, semver: insertedVersion.semver };
    });
  },

  findById(packageId) {
    return findPackageRecord(database, eq(pkg.id, packageId));
  },

  findByOrgAndSlug(organizationId, slug) {
    return findPackageRecord(
      database,
      and(eq(pkg.organizationId, organizationId), eq(pkg.slug, slug))
    );
  },

  findOwnedBySlug(ownerUserId, slug) {
    return findPackageRecord(
      database,
      and(eq(pkg.ownerUserId, ownerUserId), eq(pkg.slug, slug))
    );
  },

  async findVersion(packageId, semver) {
    const [row] = await database
      .select({ id: packageVersion.id })
      .from(packageVersion)
      .where(
        and(
          eq(packageVersion.packageId, packageId),
          eq(packageVersion.semver, semver)
        )
      )
      .limit(1);
    return row ?? null;
  },

  async insertIfUnderLimit(input, decide) {
    try {
      const row = await database.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${input.organizationId}))`
        );
        const packageCount = await countPackagesInOrg(tx, input.organizationId);
        await decide(packageCount);
        const [inserted] = await tx
          .insert(pkg)
          .values({
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            slug: input.slug,
            visibility: input.visibility,
          })
          .returning();
        if (!inserted) {
          throw new CatalogWriteError('Failed to create package');
        }
        return inserted;
      });
      return toPackageRecord(row);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new PackageSlugTakenError();
      }
      throw error;
    }
  },

  async listSemvers(packageId) {
    const rows = await database
      .select({ semver: packageVersion.semver })
      .from(packageVersion)
      .where(eq(packageVersion.packageId, packageId));
    return rows.map((row) => row.semver);
  },

  publicHandle(organizationId) {
    if (!organizationId) {
      return Promise.resolve(null);
    }
    return resolveOrganizationSlugById(database, organizationId);
  },

  async setCurrentVersion(packageId, versionId) {
    await database
      .update(pkg)
      .set({ currentVersionId: versionId })
      .where(eq(pkg.id, packageId));
  },

  async setPackageVisibility(packageId, ownerUserId, visibility) {
    await database
      .update(pkg)
      .set({ visibility })
      .where(and(eq(pkg.id, packageId), eq(pkg.ownerUserId, ownerUserId)));
  },

  async setVisibility(packageId, visibility) {
    await database.update(pkg).set({ visibility }).where(eq(pkg.id, packageId));
  },
});
