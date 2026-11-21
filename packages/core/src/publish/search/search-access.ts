import type { PackageVisibility } from '../catalog/package-visibility';

export interface SearchAccessContext {
  organizationIds: readonly string[];
  userId: string | null;
}

export interface SearchPackageAccessRow {
  organizationId: string | null;
  ownerUserId: string;
  visibility: PackageVisibility;
}

export type SearchAccessPredicate = (
  row: SearchPackageAccessRow,
  context: SearchAccessContext
) => boolean;

export interface SearchLoadPolicy {
  accessContext: (callerUserId: string) => Promise<SearchAccessContext>;
  canAccessPackage: SearchAccessPredicate;
  organizationIds: (callerUserId: string) => Promise<string[]>;
}
