import { z } from 'zod';

export const deployStartBodySchema = z.object({
  filesManifest: z
    .array(
      z.object({
        bytes: z.number().int().nonnegative(),
        path: z.string().min(1),
      })
    )
    .min(1),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  visibility: z.enum(['private', 'organization', 'library']).optional(),
});

export const workerLoaderBundleSchema = z.object({
  mainModule: z.string().min(1),
  modules: z.record(z.string(), z.string()),
});

export const deployFunctionContractSchema = z.object({
  contract: z.record(z.string(), z.unknown()),
  exportName: z.string().min(1),
  path: z.string().min(1),
  slug: z.string().min(1),
});

export const deployFinalizeBodySchema = z.object({
  bundle: workerLoaderBundleSchema,
  bundleHash: z.string().min(8).max(128),
  contracts: z.array(deployFunctionContractSchema).min(1),
  packageId: z.string().min(1),
  sourceHash: z
    .string()
    .min(7)
    .max(64)
    .regex(/^[0-9a-f]+$/iu),
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

export type DeployStartBody = z.infer<typeof deployStartBodySchema>;
export type DeployFinalizeBody = z.infer<typeof deployFinalizeBodySchema>;
export type WorkerLoaderBundle = z.infer<typeof workerLoaderBundleSchema>;
export type RuntimeExecuteBody = z.infer<typeof runtimeExecuteBodySchema>;
