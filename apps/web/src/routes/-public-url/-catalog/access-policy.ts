import { canViewCatalogPage } from '@functhis/publish';
import type {
  CatalogPackageRow,
  PackageAccessContext,
} from '@functhis/publish';

export type CatalogAccessResult =
  | {
      access: 'allow';
      context: PackageAccessContext;
    }
  | { access: 'sign-in' }
  | { access: 'not-found'; context: PackageAccessContext };

export const evaluateCatalogAccess = (
  catalog: CatalogPackageRow,
  context: PackageAccessContext
): CatalogAccessResult => {
  if (canViewCatalogPage(catalog, context)) {
    return { access: 'allow', context };
  }

  if (context.userId === null) {
    return { access: 'sign-in' };
  }

  return { access: 'not-found', context };
};
