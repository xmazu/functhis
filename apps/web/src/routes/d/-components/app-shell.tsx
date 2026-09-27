import { useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import {
  AppSidebar,
  SettingsSidebar,
} from '#/routes/d/-components/app-sidebar';
import { PackageSidebar } from '#/routes/d/-components/package-sidebar';
import { isPackageConsolePath } from '#/routes/d/-lib/package-console-path';

export const AppShell = ({ children }: { children: ReactNode }) => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const inSettings = pathname.startsWith('/d/settings');
  const inPackageConsole = isPackageConsolePath(pathname);

  let sidebar = <AppSidebar />;
  if (inPackageConsole) {
    sidebar = <PackageSidebar />;
  } else if (inSettings) {
    sidebar = <SettingsSidebar />;
  }

  return (
    <div className="bg-background flex h-svh min-h-0 flex-col md:flex-row">
      {sidebar}
      <div className="app-content-card flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
};
