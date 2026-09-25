import {
  IconBuilding,
  IconDeviceDesktop,
  IconHome,
  IconMenu2,
  IconPackage,
} from '@tabler/icons-react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';

import { authClient } from '#/lib/auth/auth-client';
import { Button } from '#/routes/d/-components/ui/button';
import { Separator } from '#/routes/d/-components/ui/separator';
import {
  Sheet,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from '#/routes/d/-components/ui/sheet';
import { cn } from '#/routes/d/-lib/utils';

const NAV_ITEMS = [
  { icon: IconHome, label: 'Home', to: '/d' },
  { icon: IconPackage, label: 'Pkgs', to: '/d/pkgs' },
  { icon: IconBuilding, label: 'Orgs', to: '/d/orgs' },
  { icon: IconDeviceDesktop, label: 'Authorize device', to: '/device' },
] as const;

const navRowClassName =
  'flex h-[var(--app-density-row-height,1.75rem)] w-full min-w-0 items-center gap-2 rounded-md px-2 text-[length:var(--app-font-size-ui,12px)] font-normal outline-hidden transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset';

const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.to === '/d'
            ? pathname === '/d' || pathname === '/d/'
            : pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;

        return (
          <Link
            className={cn(
              navRowClassName,
              isActive
                ? 'text-foreground bg-[var(--sidebar-selected)]'
                : 'text-foreground/80 hover:bg-sidebar-accent hover:text-foreground'
            )}
            key={item.to}
            onClick={onNavigate}
            to={item.to}
          >
            <Icon className="size-3.5 shrink-0 opacity-80" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

const SidebarAccount = () => {
  const { data: session } = authClient.useSession();

  if (!session) {
    return null;
  }

  return (
    <div className="mt-auto flex flex-col gap-2 px-2 pb-3">
      <Separator />
      <p className="text-foreground/80 truncate px-2 text-[length:var(--app-font-size-ui,12px)]">
        {session.user.name}
      </p>
      <Button
        className="w-full justify-start"
        onClick={() => {
          authClient.signOut();
        }}
        size="sm"
        variant="ghost"
      >
        Sign out
      </Button>
    </div>
  );
};

const SidebarBody = ({ onNavigate }: { onNavigate?: () => void }) => (
  <div className="flex h-full min-h-0 flex-col pt-3">
    <div className="mb-3 px-4">
      <p className="text-[length:var(--app-font-size-ui,12px)] font-medium tracking-tight">
        Functhis
      </p>
    </div>
    <SidebarNav onNavigate={onNavigate} />
    <SidebarAccount />
  </div>
);

const MobileSidebar = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="app-sidebar-surface flex items-center gap-2 border-b px-2 py-1.5 md:hidden">
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger
          render={
            <Button
              aria-label="Open navigation"
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <IconMenu2 />
        </SheetTrigger>
        <SheetPopup showCloseButton={false} side="left">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetPanel className="p-0" scrollFade={false}>
            <div className="app-sidebar-surface min-h-full">
              <SidebarBody
                onNavigate={() => {
                  setOpen(false);
                }}
              />
            </div>
          </SheetPanel>
        </SheetPopup>
      </Sheet>
      <p className="text-[length:var(--app-font-size-ui,12px)] font-medium">
        Functhis
      </p>
    </header>
  );
};

export const AppSidebar = () => (
  <>
    <aside className="app-sidebar-surface hidden w-64 shrink-0 flex-col md:flex">
      <SidebarBody />
    </aside>
    <MobileSidebar />
  </>
);
