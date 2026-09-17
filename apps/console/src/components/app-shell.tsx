import type { ReactNode } from 'react';

import { AppSidebar } from '@/components/app-sidebar';

export const AppShell = ({ children }: { children: ReactNode }) => (
  <div className="bg-background flex h-svh min-h-0 flex-col md:flex-row">
    <AppSidebar />
    <div className="app-content-card flex min-h-0 min-w-0 flex-1 flex-col">
      {children}
    </div>
  </div>
);
