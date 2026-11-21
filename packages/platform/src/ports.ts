import type { PackageVisibility, SecretBinding } from '@functhis/core/publish';

import type {
  AccessiblePackageListRow,
  CatalogFunctionRow,
  CatalogPackageRow,
  ExecutionSummaryRow,
  PackageListRow,
} from './access/catalog-read';

export interface MemberOrganization {
  id: string;
  slug: string;
}

export interface ActiveSubscriptionRow {
  plan: string;
  status: string;
}

export interface MembershipsPort {
  listMemberOrganizations: (userId: string) => Promise<MemberOrganization[]>;
  listOrganizationIds: (userId: string) => Promise<string[]>;
  memberRole: (
    userId: string,
    organizationId: string
  ) => Promise<string | null>;
  isMemberOfOrganization: (
    userId: string,
    organizationId: string
  ) => Promise<boolean>;
  resolveOrganizationIdForMember: (
    userId: string,
    organizationSlug: string
  ) => Promise<string | null>;
  resolveOrganizationSlugById: (
    organizationId: string
  ) => Promise<string | null>;
}

export interface ExecutionQuotaPort {
  countPackages: (organizationId: string) => Promise<number>;
  readExecutionCount: (
    organizationId: string,
    periodKey: string
  ) => Promise<number>;
  readActiveSubscription: (
    organizationId: string
  ) => Promise<ActiveSubscriptionRow | null>;
  tryReserve: (
    organizationId: string,
    periodKey: string,
    maxExecutions: number
  ) => Promise<'reserved' | 'full'>;
}

export type HostedSecretScope = 'organization' | 'package';

export interface HostedSecretListItem {
  lastUsedAt: Date | null;
  name: string;
  scope: HostedSecretScope;
  updatedAt: Date;
}

export interface HostedSecretListResult {
  canWrite: boolean;
  secrets: HostedSecretListItem[];
}

export interface SecretDirectoryPort {
  deleteOrganizationSecret: (input: {
    name: string;
    organizationId: string;
    userId: string;
  }) => Promise<void>;
  deletePackageSecret: (input: {
    name: string;
    packageId: string;
    userId: string;
  }) => Promise<void>;
  listOrganizationSecrets: (
    userId: string,
    organizationId: string
  ) => Promise<HostedSecretListResult | null>;
  listPackageSecrets: (
    userId: string,
    packageRow: { id: string; organizationId: string; ownerUserId: string }
  ) => Promise<HostedSecretListResult | null>;
  setOrganizationSecret: (input: {
    encryptionKey: SecretBinding | undefined;
    name: string;
    organizationId: string;
    userId: string;
    value: string;
  }) => Promise<HostedSecretListItem>;
  setPackageSecret: (input: {
    encryptionKey: SecretBinding | undefined;
    name: string;
    organizationId: string;
    packageId: string;
    userId: string;
    value: string;
  }) => Promise<HostedSecretListItem>;
}

export interface CatalogReadPort {
  getFunctionBySlugs: (
    handle: string,
    packageSlug: string,
    functionSlug: string
  ) => Promise<CatalogFunctionRow | null>;
  getPackageBySlugs: (
    handle: string,
    packageSlug: string
  ) => Promise<CatalogPackageRow | null>;
  listAccessiblePackagesForUser: (
    userId: string
  ) => Promise<AccessiblePackageListRow[]>;
  listOrgSharedPackages: (
    organizationIds: readonly string[]
  ) => Promise<PackageListRow[]>;
  listOwnerPackages: (ownerUserId: string) => Promise<PackageListRow[]>;
  listPackageExecutions: (
    packageId: string,
    options?: { limit?: number; retentionCutoff?: Date }
  ) => Promise<ExecutionSummaryRow[]>;
}

export interface PackageRecord {
  currentVersionId: string | null;
  id: string;
  organizationId: string;
  ownerUserId: string;
  slug: string;
  sourceKind: string;
  visibility: PackageVisibility;
}

export interface CommitVersionFunctionInput {
  contract: unknown;
  exportName: string;
  path: string;
  searchText: string;
  slug: string;
}

export interface CommitVersionInput {
  artifactKey: string;
  bundleHash: string;
  contracts: unknown;
  createdBy: string;
  deployedSlugs: readonly string[];
  functions: readonly CommitVersionFunctionInput[];
  gitDirty: boolean;
  gitSha: string | null;
  packageId: string;
  secretNames: readonly string[];
  semver: string;
  sourceHash: string;
}

export interface CommitVersionResult {
  id: string;
  semver: string;
}

export interface PackageStorePort {
  commitVersion: (input: CommitVersionInput) => Promise<CommitVersionResult>;
  findById: (packageId: string) => Promise<PackageRecord | null>;
  findByOrgAndSlug: (
    organizationId: string,
    slug: string
  ) => Promise<PackageRecord | null>;
  findOwnedBySlug: (
    ownerUserId: string,
    slug: string
  ) => Promise<PackageRecord | null>;
  findVersion: (
    packageId: string,
    semver: string
  ) => Promise<{ id: string } | null>;
  insertIfUnderLimit: (
    input: {
      organizationId: string;
      ownerUserId: string;
      slug: string;
      visibility: PackageVisibility;
    },
    decide: (packageCount: number) => void | Promise<void>
  ) => Promise<PackageRecord>;
  listSemvers: (packageId: string) => Promise<string[]>;
  publicHandle: (organizationId: string | null) => Promise<string | null>;
  setCurrentVersion: (packageId: string, versionId: string) => Promise<void>;
  setPackageVisibility: (
    packageId: string,
    ownerUserId: string,
    visibility: PackageVisibility
  ) => Promise<void>;
  setVisibility: (
    packageId: string,
    visibility: PackageVisibility
  ) => Promise<void>;
}

export interface PlatformPorts {
  catalogRead: CatalogReadPort;
  memberships: MembershipsPort;
  packages: PackageStorePort;
  quota: ExecutionQuotaPort;
  secretDirectory: SecretDirectoryPort;
}
