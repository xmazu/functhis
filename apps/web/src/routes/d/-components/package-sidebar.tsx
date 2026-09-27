import {
  IconArrowLeft,
  IconKey,
  IconLayoutDashboard,
  IconMenu2,
  IconShare,
} from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';
import {
  Link,
  getRouteApi,
  useParams,
  useRouterState,
} from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { Button } from '#/components/ui/button';
import {
  Sheet,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet';
import { usePackageDetailDashboardQuery } from '#/lib/query/dashboard-cache';
import { cn } from '#/lib/utils';
import {
  SidebarAccount,
  navRowClassName,
  sidebarAsideClassName,
} from '#/routes/d/-components/app-sidebar-primitives';
import { packageConsoleHref } from '#/routes/d/-lib/package-console-href';
import type { PackageDetailViewModel } from '#/routes/d/-server/package-detail-view-model';

const packageRouteApi = getRouteApi('/@{$handle}/$slug');

const showsSharingNav = (detail: PackageDetailViewModel): boolean =>
  detail.isOwner &&
  (detail.visibility === 'private' || detail.visibility === 'organization');

interface PackageNavItem {
  href: string;
  icon: Icon;
  isActive: (pathname: string) => boolean;
  label: string;
}

const buildPackageNavItems = (
  detail: PackageDetailViewModel
): PackageNavItem[] => {
  const items: PackageNavItem[] = [
    {
      href: packageConsoleHref(detail.handle, detail.packageSlug),
      icon: IconLayoutDashboard,
      isActive: (pathname) => {
        const base = packageConsoleHref(detail.handle, detail.packageSlug);
        return pathname === base || pathname === `${base}/`;
      },
      label: 'Overview',
    },
  ];

  if (detail.canWriteSecrets) {
    items.push({
      href: packageConsoleHref(detail.handle, detail.packageSlug, 'secrets'),
      icon: IconKey,
      isActive: (pathname) =>
        pathname ===
        packageConsoleHref(detail.handle, detail.packageSlug, 'secrets'),
      label: 'Secrets',
    });
  }

  if (showsSharingNav(detail)) {
    items.push({
      href: packageConsoleHref(detail.handle, detail.packageSlug, 'sharing'),
      icon: IconShare,
      isActive: (pathname) =>
        pathname ===
        packageConsoleHref(detail.handle, detail.packageSlug, 'sharing'),
      label: 'Sharing',
    });
  }

  return items;
};

const PackageNav = ({
  detail,
  onNavigate,
}: {
  detail: PackageDetailViewModel;
  onNavigate?: () => void;
}): ReactElement => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const items = buildPackageNavItems(detail);

  return (
    <>
      <nav className="flex flex-col gap-0.5 px-2">
        <Link
          className={cn(
            navRowClassName,
            'text-foreground/80 hover:bg-sidebar-accent hover:text-foreground'
          )}
          onClick={onNavigate}
          to="/d/pkgs"
        >
          <IconArrowLeft className="size-3.5 shrink-0 opacity-80" />
          <span className="truncate">Back to pkgs</span>
        </Link>
      </nav>
      <p
        className="text-foreground/45 mt-4 mb-1 truncate px-2 font-mono text-[length:var(--app-font-size-ui,12px)]"
        title={`@${detail.handle}/${detail.packageSlug}`}
      >
        @{detail.handle}/{detail.packageSlug}
      </p>
      <nav aria-label="Package" className="flex flex-col gap-0.5 px-2">
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
              key={item.href}
              onClick={onNavigate}
              to={item.href}
            >
              <ItemIcon className="size-3.5 shrink-0 opacity-80" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};

const PackageSidebarChrome = ({ nav }: { nav: ReactNode }): ReactElement => (
  <div className="flex h-full min-h-0 flex-col pt-3">
    {nav}
    <SidebarAccount />
  </div>
);

const PackageMobileSidebarChrome = ({
  detail,
}: {
  detail: PackageDetailViewModel;
}): ReactElement => {
  const [open, setOpen] = useState(false);

  return (
    <header className="app-sidebar-surface flex items-center gap-2 border-b px-2 py-1.5 md:hidden">
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger
          render={
            <Button
              aria-label="Open package navigation"
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <IconMenu2 />
        </SheetTrigger>
        <SheetPopup showCloseButton={false} side="left">
          <SheetTitle className="sr-only">Package navigation</SheetTitle>
          <SheetPanel className="p-0" scrollFade={false}>
            <div className="app-sidebar-surface min-h-full">
              <PackageSidebarChrome
                nav={
                  <PackageNav
                    detail={detail}
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
      <p
        className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[length:var(--app-font-size-ui,12px)]"
        title={`@${detail.handle}/${detail.packageSlug}`}
      >
        @{detail.handle}/{detail.packageSlug}
      </p>
    </header>
  );
};

export const PackageSidebar = (): ReactElement | null => {
  const { handle, slug } = useParams({ strict: false });
  const loaderDetail = packageRouteApi.useLoaderData();
  const detail = usePackageDetailDashboardQuery(
    loaderDetail,
    handle ?? '',
    slug ?? ''
  );

  if (!detail) {
    return null;
  }

  return (
    <>
      <aside className={sidebarAsideClassName}>
        <PackageSidebarChrome nav={<PackageNav detail={detail} />} />
      </aside>
      <PackageMobileSidebarChrome detail={detail} />
    </>
  );
};

export { showsSharingNav };
