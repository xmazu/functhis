/* eslint-disable max-classes-per-file -- domain catalog errors */
export class PackageSlugTakenError extends Error {
  constructor() {
    super('Package slug already exists in organization');
    this.name = 'PackageSlugTakenError';
  }
}

export class CatalogWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogWriteError';
  }
}
