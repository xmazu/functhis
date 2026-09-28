export interface PackageListItem {
  callCount: number;
  functionCount: number;
  handle: string;
  health: string;
  id: string;
  packageSlug: string;
  shared: boolean;
  sourceKind: string;
  visibility: string;
}

export type RankedPackage = PackageListItem & {
  rank: number;
};

export const withCallCounts = <T extends { id: string }>(
  packages: T[],
  counts: Map<string, number>
): (T & { callCount: number })[] =>
  packages.map((pkg) => ({
    ...pkg,
    callCount: counts.get(pkg.id) ?? 0,
  }));

export const rankPackages = (packages: PackageListItem[]): RankedPackage[] =>
  [...packages]
    .toSorted((left, right) => {
      if (right.callCount !== left.callCount) {
        return right.callCount - left.callCount;
      }
      return left.packageSlug.localeCompare(right.packageSlug);
    })
    .map((pkg, index) => ({ ...pkg, rank: index + 1 }));

export const filterRankedPackages = (
  packages: RankedPackage[],
  query: string
): RankedPackage[] => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return packages;
  }

  return packages.filter((pkg) => {
    const haystack =
      `${pkg.packageSlug} @${pkg.handle} ${pkg.sourceKind} ${pkg.health}`.toLowerCase();
    return haystack.includes(needle);
  });
};

export const formatCallCount = (count: number): string => {
  if (count >= 1000) {
    return new Intl.NumberFormat('en', {
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(count);
  }
  return count.toLocaleString('en');
};

export const formatFunctionCountLabel = (count: number): string =>
  `${count} fn`;

export const formatVisibilityLabel = (pkg: {
  shared: boolean;
  visibility: string;
}): string => {
  if (pkg.shared) {
    return `${pkg.visibility} · org`;
  }
  return pkg.visibility;
};

export const packageMetaLabel = (pkg: {
  functionCount: number;
  shared: boolean;
  visibility: string;
}): string => {
  const parts = [formatFunctionCountLabel(pkg.functionCount), pkg.visibility];
  if (pkg.shared) {
    parts.push('org');
  }
  return parts.join(' · ');
};

export const isEditableTarget = (target: unknown): boolean => {
  if (target === null || typeof target !== 'object') {
    return false;
  }
  const element = target as {
    isContentEditable?: boolean;
    tagName?: string;
  };
  if (element.isContentEditable) {
    return true;
  }
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export const shouldFocusPackageSearch = (
  event: {
    altKey: boolean;
    ctrlKey: boolean;
    key: string;
    metaKey: boolean;
  },
  target: unknown
): boolean => {
  if (event.key !== '/') {
    return false;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }
  return !isEditableTarget(target);
};
