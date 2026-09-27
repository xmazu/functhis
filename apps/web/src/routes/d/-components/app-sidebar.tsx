import {
  IconArrowLeft,
  IconChartBar,
  IconHome,
  IconKey,
  IconMenu2,
  IconPackage,
  IconSettings,
} from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { Button } from '#/components/ui/button';
import { Separator } from '#/components/ui/separator';
import {
  Sheet,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet';
import { authClient } from '#/lib/auth/auth-client';
import { cn } from '#/lib/utils';
import { SidebarOrgSwitcher } from '#/routes/d/-components/sidebar-org-switcher';

const NAV_ITEMS = [
  {
    icon: IconHome,
    isActive: (pathname: string) => pathname === '/d' || pathname === '/d/',
    label: 'Home',
    to: '/d',
  },
  {
    icon: IconPackage,
    isActive: (pathname: string) =>
      pathname === '/d/pkgs' || pathname.startsWith('/d/pkgs/'),
    label: 'Pkgs',
    to: '/d/pkgs',
  },
  {
    icon: IconSettings,
    isActive: (pathname: string) =>
      pathname === '/d/settings' || pathname.startsWith('/d/settings/'),
    label: 'Settings',
    to: '/d/settings',
  },
] as const;

const SETTINGS_ITEMS = [
  {
    icon: IconKey,
    isActive: (pathname: string) => pathname === '/d/settings/secrets',
    label: 'Secrets',
    to: '/d/settings/secrets',
  },
  {
    icon: IconChartBar,
    isActive: (pathname: string) => pathname === '/d/settings/usage',
    label: 'Usage',
    to: '/d/settings/usage',
  },
] as const;

const sidebarAsideClassName =
  'app-sidebar-surface hidden w-56 shrink-0 flex-col md:flex';

const navRowClassName =
  'flex h-[var(--app-density-row-height,1.75rem)] w-full min-w-0 items-center gap-2 rounded-md px-2 text-[length:var(--app-font-size-ui,12px)] font-normal outline-hidden transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset';

interface NavItemConfig {
  icon: Icon;
  isActive: (pathname: string) => boolean;
  label: string;
  to: string;
}

const SidebarNavList = ({
  ariaLabel,
  items,
  onNavigate,
}: {
  ariaLabel?: string;
  items: readonly NavItemConfig[];
  onNavigate?: () => void;
}): ReactElement => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-0.5 px-2">
      {items.map((item) => {
        const isActive = item.isActive(pathname);
        const ItemIcon = item.icon;

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
            <ItemIcon className="size-3.5 shrink-0 opacity-80" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

const SidebarAccount = (): ReactElement | null => {
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

const SidebarChrome = ({ nav }: { nav: ReactNode }): ReactElement => (
  <div className="flex h-full min-h-0 flex-col pt-3">
    <div className="mb-3 px-2">
      <SidebarOrgSwitcher />
    </div>
    {nav}
    <SidebarAccount />
  </div>
);

const MobileSidebarChrome = ({
  MobileNav,
  sheetTitle,
  triggerAriaLabel,
}: {
  MobileNav: (props: { onNavigate: () => void }) => ReactElement;
  sheetTitle: string;
  triggerAriaLabel: string;
}): ReactElement => {
  const [open, setOpen] = useState(false);

  return (
    <header className="app-sidebar-surface flex items-center gap-2 border-b px-2 py-1.5 md:hidden">
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger
          render={
            <Button
              aria-label={triggerAriaLabel}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <IconMenu2 />
        </SheetTrigger>
        <SheetPopup showCloseButton={false} side="left">
          <SheetTitle className="sr-only">{sheetTitle}</SheetTitle>
          <SheetPanel className="p-0" scrollFade={false}>
            <div className="app-sidebar-surface min-h-full">
              <SidebarChrome
                nav={
                  <MobileNav
                    onNavigate={() => {
                      setOpen(false);
                    }}
                  />
                }
              />
            </div>
          </SheetPanel>
        </SheetPopup>
      </Sheet>
      <SidebarOrgSwitcher className="min-w-0 flex-1" />
    </header>
  );
};

const SettingsNav = ({
  onNavigate,
}: {
  onNavigate?: () => void;
}): ReactElement => (
  <>
    <nav className="flex flex-col gap-0.5 px-2">
      <Link
        className={cn(
          navRowClassName,
          'text-foreground/80 hover:bg-sidebar-accent hover:text-foreground'
        )}
        onClick={onNavigate}
        to="/d"
      >
        <IconArrowLeft className="size-3.5 shrink-0 opacity-80" />
        <span className="truncate">Back to app</span>
      </Link>
    </nav>
    <p className="text-foreground/45 mt-4 mb-1 px-2 text-[length:var(--app-font-size-ui,12px)]">
      Workspace
    </p>
    <SidebarNavList
      ariaLabel="Organization settings"
      items={SETTINGS_ITEMS}
      onNavigate={onNavigate}
    />
  </>
);

const AppMobileNav = ({
  onNavigate,
}: {
  onNavigate: () => void;
}): ReactElement => (
  <SidebarNavList items={NAV_ITEMS} onNavigate={onNavigate} />
);

const SettingsMobileNav = ({
  onNavigate,
}: {
  onNavigate: () => void;
}): ReactElement => <SettingsNav onNavigate={onNavigate} />;

export const AppSidebar = (): ReactElement => (
  <>
    <aside className={sidebarAsideClassName}>
      <SidebarChrome nav={<SidebarNavList items={NAV_ITEMS} />} />
    </aside>
    <MobileSidebarChrome
      MobileNav={AppMobileNav}
      sheetTitle="Navigation"
      triggerAriaLabel="Open navigation"
    />
  </>
);

export const SettingsSidebar = (): ReactElement => (
  <>
    <aside className={sidebarAsideClassName}>
      <SidebarChrome nav={<SettingsNav />} />
    </aside>
    <MobileSidebarChrome
      MobileNav={SettingsMobileNav}
      sheetTitle="Organization settings"
      triggerAriaLabel="Open settings navigation"
    />
  </>
);
