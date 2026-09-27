import type { ReactNode } from 'react';

import { cn } from '#/lib/utils';

/** Shared horizontal measure for package console header and page body. */
export const packageConsoleWidthClassName = 'mx-auto w-full max-w-3xl px-4';

/** Matches package secrets / org settings reading width. */
export const packageConsoleContentClassName = cn(
  packageConsoleWidthClassName,
  'flex flex-col pb-10'
);

export const PackageConsolePage = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
    <div className={cn(packageConsoleContentClassName, className)}>
      {children}
    </div>
  </main>
);
