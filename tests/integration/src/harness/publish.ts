import {
  artifactObjectKey,
  hashPublishArtifact,
  sha256Hex,
  stableBundlePayload,
} from '@functhis/publish';
import type { VersionBump } from '@functhis/publish';
import {
  handlePublishFinalize,
  handlePublishStart,
} from '@functhis/publish/http';
import type { PublishHandlerContext } from '@functhis/publish/http';

export const deployAuthHeaders = (
  accessToken: string
): Record<string, string> => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

export const sampleWorkerBundle = (): {
  mainModule: string;
  modules: Record<string, string>;
} => ({
  mainModule: 'main.js',
  modules: { 'main.js': 'export default async () => ({ ok: true });' },
});

export const sampleArtifact = (
  slug: string,
  secrets: string[] = []
): {
  buildJson: string;
  bundle: string;
  manifestJson: string;
  sourceMap: string;
} => ({
  buildJson: JSON.stringify({ cliVersion: '0.1.0' }),
  bundle: sampleWorkerBundle().modules['main.js'] ?? '',
  manifestJson: JSON.stringify({ package: slug, secrets }),
  sourceMap: '{}',
});

export const startPackage = (
  ctx: PublishHandlerContext,
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> =>
  handlePublishStart(
    new Request('http://localhost/api/publish/start', {
      body: JSON.stringify(body),
      headers: deployAuthHeaders(accessToken),
      method: 'POST',
    }),
    ctx
  );

export interface FinalizePackageInput {
  bump?: VersionBump;
  contracts?: {
    contract: Record<string, unknown>;
    exportName: string;
    path: string;
    slug: string;
  }[];
  gitDirty?: boolean;
  gitSha?: string;
  packageId: string;
  secrets?: string[];
  slug: string;
}

export const finalizePackage = async (
  ctx: PublishHandlerContext,
  accessToken: string,
  input: FinalizePackageInput
): Promise<Response> => {
  const bundle = sampleWorkerBundle();
  const artifact = sampleArtifact(input.slug, input.secrets);
  const bundleHash = await sha256Hex(stableBundlePayload(bundle));
  const contentHash = await hashPublishArtifact(artifact);
  return handlePublishFinalize(
    new Request('http://localhost/api/publish/finalize', {
      body: JSON.stringify({
        artifact,
        bump: input.bump,
        bundle,
        bundleHash,
        contentHash,
        contracts: input.contracts ?? [
          {
            contract: { description: 'hello' },
            exportName: 'default',
            path: 'hello.ts',
            slug: 'hello',
          },
        ],
        gitDirty: input.gitDirty,
        gitSha: input.gitSha,
        packageId: input.packageId,
        sourceHash: 'abcdef0123456',
      }),
      headers: deployAuthHeaders(accessToken),
      method: 'POST',
    }),
    ctx
  );
};

export const artifactObjectKeys = (contentHash: string): string[] => [
  artifactObjectKey(contentHash, 'bundle.mjs'),
  artifactObjectKey(contentHash, 'bundle.mjs.map'),
  artifactObjectKey(contentHash, 'manifest.json'),
  artifactObjectKey(contentHash, 'build.json'),
];
