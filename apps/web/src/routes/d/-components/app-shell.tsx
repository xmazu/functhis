import { useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import {
  AppSidebar,
  SettingsSidebar,
} from '#/routes/d/-components/app-sidebar';

export const AppShell = ({ children }: { children: ReactNode }) => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const inSettings = pathname.startsWith('/d/settings');

  return (
    <div className="bg-background flex h-svh min-h-0 flex-col md:flex-row">
      {inSettings ? <SettingsSidebar /> : <AppSidebar />}
      <div className="app-content-card flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
};
