import type {
  AccessiblePackageListRow,
  CatalogFunctionRow,
  CatalogPackageRow,
  ExecutionSummaryRow,
  PackageListRow,
} from './catalog/catalog-read';
import type { HotFunctionDoc, SearchDomain } from './catalog/hot-catalog';
import type { PackageVisibility } from './catalog/package-visibility';
import type { IdempotencyRecord } from './execution/idempotency';
import type { ParsedFunctionId } from './function-id';
import type { MemberOrganization } from './org/org-membership-read';
import type { SecretBinding } from './secret-binding';
import type {
  HostedSecretListItem,
  HostedSecretListResult,
} from './secrets/hosted-secrets';

export interface PackageRecord {
  currentVersionId: string | null;
  id: string;
  organizationId: string;
  ownerUserId: string;
  slug: string;
  sourceKind: string;
  visibility: PackageVisibility;
}

export interface ActiveSubscriptionRow {
  plan: string;
  status: string;
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

export interface PackageHotFunctionRow {
  bundleHash: string;
  contract: unknown;
  functionId: string;
  functionSlug: string;
  hostAllowlist: string[] | null;
  searchText: string | null;
  strictOutput: boolean | null;
  versionId: string;
}

export interface PackageHotProjection {
  functions: PackageHotFunctionRow[];
  handle: string;
  indexHandles: string[];
  package: PackageRecord;
}

export interface EncryptedSecretRow {
  ciphertext: string;
  id: string;
  lastUsedAt: Date | null;
  name: string;
  nonce: string;
  packageId: string | null;
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

export interface HotCatalogSourcePort {
  listFunctionIds: (
    domain: SearchDomain,
    callerUserId: string,
    organizationIds: readonly string[]
  ) => Promise<string[]>;
  listPackageIdsWithCurrentVersion: () => Promise<string[]>;
  loadFunctionDoc: (parsed: ParsedFunctionId) => Promise<HotFunctionDoc | null>;
  loadPackageProjection: (
    packageId: string
  ) => Promise<PackageHotProjection | null>;
}

export interface IdempotencyStorePort {
  claim: (input: {
    key: string;
    organizationId: string;
    requestHash: string;
  }) => Promise<void>;
  complete: (input: {
    bodyText: string;
    key: string;
    organizationId: string;
    status: number;
  }) => Promise<void>;
  load: (
    organizationId: string,
    key: string
  ) => Promise<IdempotencyRecord | null>;
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

export interface ExecutionLogPort {
  insertStarted: (input: {
    callerUserId?: string | null;
    executionId: string;
    functionId?: string;
    organizationId: string;
    packageVersionId: string;
    requestBytes: number;
    startedAt: Date;
  }) => Promise<void>;
  upsertCompleted: (input: {
    callerUserId?: string | null;
    completedAt: Date;
    cpuMs: number;
    executionId: string;
    functionId?: string;
    organizationId: string;
    packageVersionId: string;
    requestBytes: number;
    responseBytes: number;
    startedAt: Date;
    status: string;
  }) => Promise<void>;
}

export interface RuntimeSecretsPort {
  loadPackageVersionSecretNames: (versionId: string) => Promise<string[]>;
  resolveRuntimeSecrets: (input: {
    encryptionKey: SecretBinding | undefined;
    organizationId: string;
    packageId: string;
    secretNames: readonly string[];
  }) => Promise<Record<string, string>>;
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

/** SQL-heavy source catalog writes (OpenAPI / remote MCP). */
export interface SourceStorePort {
  acceptOpenApiGeneration: (input: unknown) => Promise<unknown>;
  commitOpenApiImport: (input: unknown) => Promise<unknown>;
  rollbackOpenApiGeneration: (input: unknown) => Promise<unknown>;
  syncRemoteMcpSource: (input: unknown) => Promise<unknown>;
}

export interface CatalogPorts {
  catalogRead: CatalogReadPort;
  executionLog: ExecutionLogPort;
  hotSource: HotCatalogSourcePort;
  idempotency: IdempotencyStorePort;
  memberships: MembershipsPort;
  packages: PackageStorePort;
  quota: ExecutionQuotaPort;
  runtimeSecrets: RuntimeSecretsPort;
  secretDirectory: SecretDirectoryPort;
  sources: SourceStorePort;
}

export type { OrgPlanId } from './org/org-entitlements';
