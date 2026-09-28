import { IconSearch, IconSlash } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '#/components/ui/input-group';
import { cn } from '#/lib/utils';
import { packageConsoleHref } from '#/routes/d/-lib/package-console-href';
import {
  filterRankedPackages,
  formatCallCount,
  formatFunctionCountLabel,
  formatVisibilityLabel,
  rankPackages,
  shouldFocusPackageSearch,
} from '#/routes/d/-lib/package-list';
import type { PackageListItem } from '#/routes/d/-lib/package-list';

const ui = 'text-[length:var(--app-font-size-ui,12px)]';

const rowGridClassName =
  'grid h-[var(--app-density-row-height,1.75rem)] grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[2rem_minmax(0,1fr)_3.75rem_6rem_4.5rem_6rem_5rem] lg:gap-4';

const metricHeaderClassName = 'hidden px-2 text-right lg:block';
const metricCellClassName = 'px-2 text-right tabular-nums';
const metricCellClassNameLg = cn(metricCellClassName, 'hidden lg:block');

export const PackageList = ({
  packages,
}: {
  packages: PackageListItem[];
}): ReactElement => {
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const ranked = rankPackages(packages);
  const visible = filterRankedPackages(ranked, query);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!shouldFocusPackageSearch(event, event.target)) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  if (packages.length === 0) {
    return (
      <p className={`${ui} text-muted-foreground py-3`}>
        No deployed packages yet. Run{' '}
        <code className="font-mono">functhis publish</code> from a project.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="w-full min-w-0 pt-3 pb-2">
        <InputGroup className="flex w-full min-w-0 rounded-lg">
          <label className="sr-only" htmlFor={searchId}>
            Search packages
          </label>
          <InputGroupAddon align="inline-start" className="pl-3">
            <IconSearch
              aria-hidden="true"
              className="text-muted-foreground size-4"
              stroke={1.5}
            />
          </InputGroupAddon>
          <InputGroupInput
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="w-full min-w-0"
            id={searchId}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search packages…"
            ref={searchRef}
            spellCheck={false}
            type="search"
            value={query}
          />
          <InputGroupAddon align="inline-end" className="hidden pr-3 sm:flex">
            <span
              aria-hidden="true"
              className="text-muted-foreground flex size-5 items-center justify-center rounded-sm border"
            >
              <IconSlash className="size-3" stroke={1.5} />
            </span>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div
        className={cn(
          ui,
          'text-muted-foreground hidden w-full min-w-0 border-b lg:grid',
          rowGridClassName
        )}
      >
        <span className="tabular-nums">#</span>
        <span>Package</span>
        <span className={metricHeaderClassName}>Fns</span>
        <span className={metricHeaderClassName}>Source</span>
        <span className={metricHeaderClassName}>Health</span>
        <span className={metricHeaderClassName}>Visibility</span>
        <span className={metricHeaderClassName}>Calls</span>
      </div>
      {visible.length === 0 ? (
        <output className={`${ui} text-muted-foreground py-3`}>
          No packages match.
        </output>
      ) : (
        <ul className="flex w-full min-w-0 flex-col">
          {visible.map((pkg) => (
            <li className="min-w-0" key={pkg.id}>
              <Link
                className={cn(
                  ui,
                  rowGridClassName,
                  'hover:bg-secondary w-full min-w-0 border-b'
                )}
                to={packageConsoleHref(pkg.handle, pkg.packageSlug)}
              >
                <span className="text-muted-foreground tabular-nums">
                  {pkg.rank}
                </span>
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-medium">
                    {pkg.packageSlug}
                  </span>
                  <span className="text-muted-foreground truncate">
                    @{pkg.handle}
                  </span>
                </span>
                <span
                  className={cn(metricCellClassNameLg, 'text-muted-foreground')}
                >
                  {formatFunctionCountLabel(pkg.functionCount)}
                </span>
                <span
                  className={cn(
                    metricCellClassNameLg,
                    'text-muted-foreground truncate'
                  )}
                >
                  {pkg.sourceKind.replaceAll('_', ' ')}
                </span>
                <span
                  className={cn(
                    metricCellClassNameLg,
                    'text-muted-foreground truncate'
                  )}
                >
                  {pkg.health}
                </span>
                <span
                  className={cn(
                    metricCellClassNameLg,
                    'text-muted-foreground truncate'
                  )}
                >
                  {formatVisibilityLabel(pkg)}
                </span>
                <span className={metricCellClassName}>
                  {formatCallCount(pkg.callCount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
