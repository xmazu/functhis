import { describe, expect, test } from 'bun:test';

import {
  filterRankedPackages,
  formatCallCount,
  formatFunctionCountLabel,
  formatVisibilityLabel,
  isEditableTarget,
  packageMetaLabel,
  rankPackages,
  shouldFocusPackageSearch,
  withCallCounts,
} from './package-list';
import type { PackageListItem } from './package-list';

const item = (
  overrides: Partial<PackageListItem> &
    Pick<PackageListItem, 'id' | 'packageSlug'>
): PackageListItem => ({
  callCount: 0,
  functionCount: 1,
  handle: 'acme',
  health: 'ready',
  shared: false,
  sourceKind: 'hosted_function',
  visibility: 'private',
  ...overrides,
});

describe('withCallCounts', () => {
  test('attaches counts and defaults missing ids to zero', () => {
    const counted = withCallCounts(
      [{ id: 'a' }, { id: 'b' }],
      new Map([['a', 12]])
    );
    expect(counted).toEqual([
      { callCount: 12, id: 'a' },
      { callCount: 0, id: 'b' },
    ]);
  });
});

describe('rankPackages', () => {
  test('sorts by calls descending then slug, with stable ranks', () => {
    const ranked = rankPackages([
      item({ callCount: 2, id: 'tools', packageSlug: 'tools' }),
      item({ callCount: 9, id: 'hello', packageSlug: 'hello' }),
      item({ callCount: 9, id: 'alpha', packageSlug: 'alpha' }),
    ]);
    expect(ranked.map((pkg) => pkg.packageSlug)).toEqual([
      'alpha',
      'hello',
      'tools',
    ]);
    expect(ranked.map((pkg) => pkg.rank)).toEqual([1, 2, 3]);
  });
});

describe('filterRankedPackages', () => {
  test('keeps original rank and matches slug or handle', () => {
    const ranked = rankPackages([
      item({ callCount: 3, handle: 'acme', id: 'a', packageSlug: 'tools' }),
      item({ callCount: 1, handle: 'beta', id: 'b', packageSlug: 'hello' }),
    ]);
    expect(
      filterRankedPackages(ranked, 'ToO').map((pkg) => [
        pkg.packageSlug,
        pkg.rank,
      ])
    ).toEqual([['tools', 1]]);
    expect(
      filterRankedPackages(ranked, '@beta').map((pkg) => pkg.packageSlug)
    ).toEqual(['hello']);
    expect(filterRankedPackages(ranked, '  ').length).toBe(2);
  });
});

describe('formatCallCount', () => {
  test('uses locale grouping below one thousand and compact above', () => {
    expect(formatCallCount(0)).toBe('0');
    expect(formatCallCount(12)).toBe('12');
    expect(formatCallCount(999)).toBe('999');
    expect(formatCallCount(1000)).toBe('1K');
    expect(formatCallCount(1200)).toBe('1.2K');
    expect(formatCallCount(3_600_000)).toBe('3.6M');
  });
});

describe('formatFunctionCountLabel', () => {
  test('uses fn suffix', () => {
    expect(formatFunctionCountLabel(1)).toBe('1 fn');
    expect(formatFunctionCountLabel(12)).toBe('12 fn');
  });
});

describe('formatVisibilityLabel', () => {
  test('shows visibility and org when shared', () => {
    expect(
      formatVisibilityLabel({ shared: false, visibility: 'private' })
    ).toBe('private');
    expect(
      formatVisibilityLabel({ shared: true, visibility: 'organization' })
    ).toBe('organization · org');
  });
});

describe('packageMetaLabel', () => {
  test('joins function count, visibility, and shared org', () => {
    expect(
      packageMetaLabel({
        functionCount: 3,
        shared: false,
        visibility: 'private',
      })
    ).toBe('3 fn · private');
    expect(
      packageMetaLabel({
        functionCount: 1,
        shared: true,
        visibility: 'organization',
      })
    ).toBe('1 fn · organization · org');
  });
});

describe('shouldFocusPackageSearch', () => {
  test('focuses slash unless a modifier or editable target is active', () => {
    const keys = {
      altKey: false,
      ctrlKey: false,
      key: '/',
      metaKey: false,
    };
    expect(shouldFocusPackageSearch(keys, null)).toBe(true);
    expect(shouldFocusPackageSearch({ ...keys, key: 'k' }, null)).toBe(false);
    expect(shouldFocusPackageSearch({ ...keys, metaKey: true }, null)).toBe(
      false
    );

    const input = { isContentEditable: false, tagName: 'INPUT' };
    expect(isEditableTarget(input)).toBe(true);
    expect(shouldFocusPackageSearch(keys, input)).toBe(false);
    expect(isEditableTarget({ isContentEditable: true, tagName: 'DIV' })).toBe(
      true
    );
  });
});
