import { z } from 'zod';

const handleSlug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

const functionSlug = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/u);

export const versionBumpSchema = z.enum(['major', 'minor', 'patch']);

export const publishStartBodySchema = z.object({
  filesManifest: z
    .array(
      z.object({
        bytes: z.number().int().nonnegative(),
        path: z.string().min(1),
      })
    )
    .min(1),
  organizationSlug: handleSlug.optional(),
  scope: handleSlug.optional(),
  slug: handleSlug,
  visibility: z.enum(['private', 'organization', 'library']).optional(),
});

export const workerLoaderBundleSchema = z.object({
  mainModule: z.string().min(1),
  modules: z.record(z.string(), z.string()),
});

export const publishArtifactSchema = z.object({
  buildJson: z.string().min(1),
  bundle: z.string().min(1),
  manifestJson: z.string().min(1),
  sourceMap: z.string(),
});

export const publishFunctionContractSchema = z.object({
  contract: z.record(z.string(), z.unknown()),
  exportName: z.string().min(1),
  path: z.string().min(1),
  slug: functionSlug,
});

export const publishFinalizeBodySchema = z.object({
  artifact: publishArtifactSchema,
  bump: versionBumpSchema.optional(),
  bundle: workerLoaderBundleSchema,
  bundleHash: z.string().min(8).max(128),
  contentHash: z
    .string()
    .min(16)
    .max(64)
    .regex(/^[0-9a-f]+$/iu),
  contracts: z.array(publishFunctionContractSchema).min(1),
  gitDirty: z.boolean().optional(),
  gitSha: z
    .string()
    .min(7)
    .max(64)
    .regex(/^[0-9a-f]+$/iu)
    .optional(),
  packageId: z.string().min(1),
  sourceHash: z
    .string()
    .min(7)
    .max(64)
    .regex(/^[0-9a-f]+$/iu),
});

export const publishFinalizeResponseSchema = z.object({
  artifactKey: z.string().min(1),
  bundleHash: z.string().min(8).max(128),
  bundleKvKey: z.string().min(1),
  currentVersionId: z.string().min(1),
  functions: z.array(z.object({ slug: z.string().min(1) })).min(1),
  handle: z.string().min(1),
  packageId: z.string().min(1),
  semver: z.string().min(1),
  slug: z.string().min(1),
  versionId: z.string().min(1),
});

export const publishRollbackBodySchema = z
  .object({
    packageId: z.string().min(1).optional(),
    scope: handleSlug.optional(),
    semver: z.string().regex(/^\d+\.\d+\.\d+$/u),
    slug: handleSlug.optional(),
  })
  .refine((value) => Boolean(value.packageId || value.slug), {
    message: 'packageId or slug is required',
  });

export const publishRollbackResponseSchema = z.object({
  currentVersionId: z.string().min(1),
  handle: z.string().min(1),
  packageId: z.string().min(1),
  semver: z.string().min(1),
  slug: z.string().min(1),
});

export const executeBodySchema = z.object({
  functionSlug: z.string().min(1),
  input: z.unknown().optional(),
  versionId: z.string().min(1),
});

export const runtimeExecuteBodySchema = z.object({
  bundleHash: z.string().min(8).max(128),
  callerUserId: z.string().min(1).optional(),
  functionSlug: z.string().min(1).optional(),
  input: z.unknown().optional(),
  versionId: z.string().min(1),
});

export type PublishStartBody = z.infer<typeof publishStartBodySchema>;
export type PublishFinalizeBody = z.infer<typeof publishFinalizeBodySchema>;
export type PublishFinalizeResponse = z.infer<
  typeof publishFinalizeResponseSchema
>;
export type PublishRollbackBody = z.infer<typeof publishRollbackBodySchema>;
export type PublishRollbackResponse = z.infer<
  typeof publishRollbackResponseSchema
>;
export type WorkerLoaderBundle = z.infer<typeof workerLoaderBundleSchema>;
export type PublishArtifactBody = z.infer<typeof publishArtifactSchema>;

/** Same rule as `publishStartBodySchema.slug`. */
export const isValidPackageSlug = (slug: string): boolean =>
  publishStartBodySchema.shape.slug.safeParse(slug).success;
export type RuntimeExecuteBody = z.infer<typeof runtimeExecuteBodySchema>;
