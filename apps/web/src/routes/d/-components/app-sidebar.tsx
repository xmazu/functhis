import {
  IconArrowLeft,
  IconChartBar,
  IconHome,
  IconKey,
  IconPackage,
  IconSettings,
} from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';
import { Link, useRouterState } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { cn } from '#/lib/utils';
import {
  MobileSidebarChrome,
  SidebarChrome,
  navRowClassName,
  sidebarAsideClassName,
} from '#/routes/d/-components/app-sidebar-primitives';

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
      pathname === '/d/pkgs' || pathname === '/d/pkgs/',
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

export {
  MobileSidebarChrome,
  SidebarAccount,
  SidebarChrome,
  navRowClassName,
  sidebarAsideClassName,
} from '#/routes/d/-components/app-sidebar-primitives';
