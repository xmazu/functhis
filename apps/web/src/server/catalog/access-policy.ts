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
  | { access: 'sign-in' };

export const evaluateCatalogAccess = (
  catalog: CatalogPackageRow,
  context: PackageAccessContext,
  options?: { relaxInDevelopment?: boolean }
): CatalogAccessResult => {
  const relaxInDevelopment = options?.relaxInDevelopment ?? false;

  if (
    canViewCatalogPage(catalog, context, {
      relaxInDevelopment,
    })
  ) {
    return { access: 'allow', context };
  }

  return { access: 'sign-in' };
};
