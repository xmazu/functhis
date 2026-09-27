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
  'grid h-[var(--app-density-row-height,1.75rem)] grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[2rem_minmax(0,1fr)_3.25rem_5.5rem_4.5rem] lg:gap-4';

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
      <div className="pt-3 pb-2">
        <InputGroup className="rounded-lg">
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
          'text-muted-foreground hidden border-b lg:grid',
          rowGridClassName
        )}
      >
        <span className="tabular-nums">#</span>
        <span>Package</span>
        <span className="hidden text-right lg:block">Fns</span>
        <span className="hidden text-right lg:block">Visibility</span>
        <span className="text-right">Calls</span>
      </div>
      {visible.length === 0 ? (
        <output className={`${ui} text-muted-foreground py-3`}>
          No packages match.
        </output>
      ) : (
        <ul className="flex flex-col">
          {visible.map((pkg) => (
            <li key={pkg.id}>
              <Link
                className={cn(
                  ui,
                  rowGridClassName,
                  'hover:bg-secondary border-b'
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
                <span className="text-muted-foreground hidden text-right tabular-nums lg:block">
                  {formatFunctionCountLabel(pkg.functionCount)}
                </span>
                <span className="text-muted-foreground hidden truncate text-right lg:block">
                  {formatVisibilityLabel(pkg)}
                </span>
                <span className="text-right tabular-nums">
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
