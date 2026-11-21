export type BundleLoadErrorCode = 'invalid' | 'not_found';

export class StoredBundleLoadError extends Error {
  readonly bundleHash: string;
  readonly code: BundleLoadErrorCode;

  constructor(code: BundleLoadErrorCode, bundleHash: string) {
    const message =
      code === 'not_found'
        ? `Bundle not found in KV: ${bundleHash}`
        : `Invalid bundle payload in KV: ${bundleHash}`;
    super(message);
    this.name = 'StoredBundleLoadError';
    this.code = code;
    this.bundleHash = bundleHash;
  }
}
