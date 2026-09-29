import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { organization, user } from './auth';

export const packageVisibility = pgEnum('package_visibility', [
  'private',
  'organization',
  'library',
]);

export const pkg = pgTable(
  'package',
  {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    currentVersionId: text('current_version_id'),
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, {
        onDelete: 'cascade',
      }),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    sourceKind: text('source_kind').default('hosted_function').notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(
        () =>
          /* @__PURE__ */
          new Date()
      )
      .notNull(),
    visibility: packageVisibility('visibility').default('private').notNull(),
  },
  (table) => [
    uniqueIndex('package_org_slug_uidx').on(table.organizationId, table.slug),
    index('package_owner_user_id_idx').on(table.ownerUserId),
    index('package_organization_id_idx').on(table.organizationId),
  ]
);

export const packageVersion = pgTable(
  'package_version',
  {
    artifactKey: text('artifact_key').notNull(),
    bundleHash: text('bundle_hash').notNull(),
    contracts: jsonb('contracts').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    gitDirty: boolean('git_dirty').default(false).notNull(),
    gitSha: text('git_sha'),
    hostAllowlist: text('host_allowlist').array(),
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    packageId: text('package_id')
      .notNull()
      .references(() => pkg.id, { onDelete: 'cascade' }),
    runtimeVersion: text('runtime_version').notNull(),
    secretNames: text('secret_names')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    semver: text('semver').notNull(),
    sourceHash: text('source_hash').notNull(),
    strictOutput: boolean('strict_output').default(false).notNull(),
  },
  (table) => [
    index('package_version_package_id_idx').on(table.packageId),
    uniqueIndex('package_version_package_id_semver_uidx').on(
      table.packageId,
      table.semver
    ),
  ]
);

export const pkgFunction = pgTable(
  'function',
  {
    contract: jsonb('contract').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    exportName: text('export_name').notNull(),
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    packageId: text('package_id')
      .notNull()
      .references(() => pkg.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    searchText: text('search_text'),
    slug: text('slug').notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(
        () =>
          /* @__PURE__ */
          new Date()
      )
      .notNull(),
  },
  (table) => [
    uniqueIndex('function_package_id_slug_uidx').on(
      table.packageId,
      table.slug
    ),
    index('function_package_id_idx').on(table.packageId),
  ]
);

export const orgUsagePeriod = pgTable(
  'org_usage_period',
  {
    executionCount: integer('execution_count').default(0).notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    periodKey: text('period_key').notNull(),
  },
  (table) => [
    uniqueIndex('org_usage_period_org_period_uidx').on(
      table.organizationId,
      table.periodKey
    ),
  ]
);

export const execution = pgTable(
  'execution',
  {
    callerUserId: text('caller_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    completedAt: timestamp('completed_at'),
    cpuMs: integer('cpu_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    functionId: text('function_id').references(() => pkgFunction.id, {
      onDelete: 'set null',
    }),
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    packageVersionId: text('package_version_id')
      .notNull()
      .references(() => packageVersion.id, { onDelete: 'cascade' }),
    requestBytes: integer('request_bytes'),
    responseBytes: integer('response_bytes'),
    startedAt: timestamp('started_at'),
    status: text('status').notNull(),
  },
  (table) => [
    index('execution_organization_id_idx').on(table.organizationId),
    index('execution_package_version_id_idx').on(table.packageVersionId),
    index('execution_created_at_idx').on(table.createdAt),
    index('execution_caller_user_id_idx').on(table.callerUserId),
    index('execution_status_idx').on(table.status),
  ]
);

export const hostedSecret = pgTable(
  'secret',
  {
    ciphertext: text('ciphertext').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    keyVersion: integer('key_version').default(1).notNull(),
    lastUsedAt: timestamp('last_used_at'),
    name: text('name').notNull(),
    nonce: text('nonce').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    packageId: text('package_id').references(() => pkg.id, {
      onDelete: 'cascade',
    }),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(
        () =>
          /* @__PURE__ */
          new Date()
      )
      .notNull(),
    updatedBy: text('updated_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
  },
  (table) => [
    uniqueIndex('secret_org_name_uidx')
      .on(table.organizationId, table.name)
      .where(sql`${table.packageId} is null`),
    uniqueIndex('secret_package_name_uidx')
      .on(table.packageId, table.name)
      .where(sql`${table.packageId} is not null`),
    index('secret_organization_id_idx').on(table.organizationId),
    index('secret_package_id_idx').on(table.packageId),
  ]
);

export const capabilitySource = pgTable(
  'capability_source',
  {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    credentialName: text('credential_name'),
    currentGeneration: integer('current_generation').default(0).notNull(),
    endpoint: text('endpoint').notNull(),
    health: text('health').default('ready').notNull(),
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    kind: text('kind').notNull(),
    lastError: text('last_error'),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    packageId: text('package_id').references(() => pkg.id, {
      onDelete: 'cascade',
    }),
    schemaHash: text('schema_hash'),
    slug: text('slug').notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(
        () =>
          /* @__PURE__ */
          new Date()
      )
      .notNull(),
  },
  (table) => [
    uniqueIndex('capability_source_org_slug_uidx').on(
      table.organizationId,
      table.slug
    ),
    index('capability_source_organization_id_idx').on(table.organizationId),
    index('capability_source_package_id_idx').on(table.packageId),
  ]
);

export const capabilityGeneration = pgTable(
  'capability_generation',
  {
    contractBundle: jsonb('contract_bundle').notNull(),
    contractHash: text('contract_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    generation: integer('generation').notNull(),
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceId: text('source_id')
      .notNull()
      .references(() => capabilitySource.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('capability_generation_source_generation_uidx').on(
      table.sourceId,
      table.generation
    ),
    index('capability_generation_source_id_idx').on(table.sourceId),
  ]
);

export const executeIdempotency = pgTable(
  'execute_idempotency',
  {
    bodyText: text('body_text'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    key: text('key').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    requestHash: text('request_hash').notNull(),
    responseStatus: integer('response_status'),
    status: text('status').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('execute_idempotency_org_key_uidx').on(
      table.organizationId,
      table.key
    ),
    index('execute_idempotency_updated_at_idx').on(table.updatedAt),
  ]
);

export const pkgRelations = relations(pkg, ({ one, many }) => ({
  currentVersion: one(packageVersion, {
    fields: [pkg.currentVersionId],
    references: [packageVersion.id],
    relationName: 'package_current_version',
  }),
  functions: many(pkgFunction),
  organization: one(organization, {
    fields: [pkg.organizationId],
    references: [organization.id],
  }),
  owner: one(user, {
    fields: [pkg.ownerUserId],
    references: [user.id],
  }),
  secrets: many(hostedSecret),
  versions: many(packageVersion),
}));

export const packageVersionRelations = relations(
  packageVersion,
  ({ one, many }) => ({
    createdByUser: one(user, {
      fields: [packageVersion.createdBy],
      references: [user.id],
    }),
    executions: many(execution),
    package: one(pkg, {
      fields: [packageVersion.packageId],
      references: [pkg.id],
    }),
  })
);

export const pkgFunctionRelations = relations(pkgFunction, ({ one, many }) => ({
  executions: many(execution),
  package: one(pkg, {
    fields: [pkgFunction.packageId],
    references: [pkg.id],
  }),
}));

export const hostedSecretRelations = relations(hostedSecret, ({ one }) => ({
  organization: one(organization, {
    fields: [hostedSecret.organizationId],
    references: [organization.id],
  }),
  package: one(pkg, {
    fields: [hostedSecret.packageId],
    references: [pkg.id],
  }),
  updatedByUser: one(user, {
    fields: [hostedSecret.updatedBy],
    references: [user.id],
  }),
}));

export const executionRelations = relations(execution, ({ one }) => ({
  caller: one(user, {
    fields: [execution.callerUserId],
    references: [user.id],
  }),
  function: one(pkgFunction, {
    fields: [execution.functionId],
    references: [pkgFunction.id],
  }),
  organization: one(organization, {
    fields: [execution.organizationId],
    references: [organization.id],
  }),
  packageVersion: one(packageVersion, {
    fields: [execution.packageVersionId],
    references: [packageVersion.id],
  }),
}));
