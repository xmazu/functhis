import { sha256Hex } from './bundle';

export const ARTIFACT_FILES = [
  'bundle.mjs',
  'bundle.mjs.map',
  'manifest.json',
  'build.json',
] as const;

export interface PublishArtifact {
  bundle: string;
  buildJson: string;
  manifestJson: string;
  sourceMap: string;
}

export const artifactPrefix = (contentHash: string): string =>
  `artifacts/sha256/${contentHash.slice(0, 2)}/${contentHash}`;

export const artifactObjectKey = (
  contentHash: string,
  fileName: (typeof ARTIFACT_FILES)[number]
): string => `${artifactPrefix(contentHash)}/${fileName}`;

export const stableArtifactPayload = (artifact: PublishArtifact): string =>
  JSON.stringify({
    buildJson: artifact.buildJson,
    bundle: artifact.bundle,
    manifestJson: artifact.manifestJson,
    sourceMap: artifact.sourceMap,
  });

export const hashPublishArtifact = (
  artifact: PublishArtifact
): Promise<string> => sha256Hex(stableArtifactPayload(artifact));
