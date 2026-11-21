import type { HotFunctionDoc, SearchDomain } from './catalog/hot-catalog';
import type { PackageVisibility } from './catalog/package-visibility';
import type { IdempotencyRecord } from './execution/idempotency';
import type { ExecutionLabels } from './execution/labels';
import type { ParsedFunctionId } from './function-id';
import type { SecretBinding } from './secret-binding';

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

export interface ExecutionLogPort {
  insertStarted: (input: {
    actorId?: string | null;
    executionId: string;
    functionId?: string;
    labels: ExecutionLabels;
    packageVersionId: string;
    requestBytes: number;
    startedAt: Date;
  }) => Promise<void>;
  upsertCompleted: (input: {
    actorId?: string | null;
    completedAt: Date;
    cpuMs: number;
    executionId: string;
    functionId?: string;
    labels: ExecutionLabels;
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
    packageId: string;
    secretNames: readonly string[];
  }) => Promise<Record<string, string>>;
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

export interface SourceSyncMembershipsPort {
  resolveOrganizationSlugById: (
    organizationId: string
  ) => Promise<string | null>;
}

export interface SourceStorePort {
  acceptOpenApiGeneration: (input: unknown) => Promise<unknown>;
  commitOpenApiImport: (input: unknown) => Promise<unknown>;
  rollbackOpenApiGeneration: (input: unknown) => Promise<unknown>;
  syncRemoteMcpSource: (input: unknown) => Promise<unknown>;
}

export interface CatalogPorts {
  executionLog: ExecutionLogPort;
  hotSource: HotCatalogSourcePort;
  idempotency: IdempotencyStorePort;
  packages: PackageStorePort;
  runtimeSecrets: RuntimeSecretsPort;
  sources: SourceStorePort;
}
