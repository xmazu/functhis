import { BUNDLE_KV_PREFIX } from './constants';

export interface WorkerLoaderBundleShape {
  mainModule: string;
  modules: Record<string, string>;
}

export const bundleKvKey = (bundleHash: string): string =>
  `${BUNDLE_KV_PREFIX}${bundleHash}`;

export const stableBundlePayload = (
  bundle: WorkerLoaderBundleShape
): string => {
  const moduleKeys = Object.keys(bundle.modules).toSorted();
  const modules: Record<string, string> = {};
  for (const key of moduleKeys) {
    modules[key] = bundle.modules[key] ?? '';
  }
  return JSON.stringify({
    mainModule: bundle.mainModule,
    modules,
  });
};

export const utf8ByteLength = (value: string): number =>
  new TextEncoder().encode(value).byteLength;

export const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const stableSourcePayload = (files: Record<string, string>): string => {
  const paths = Object.keys(files).toSorted();
  return JSON.stringify(
    paths.map((filePath) => [filePath, files[filePath] ?? ''])
  );
};

export const hashSourceTree = (
  files: Record<string, string>
): Promise<string> => sha256Hex(stableSourcePayload(files));
