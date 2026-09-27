import { IconMenu2 } from '@tabler/icons-react';
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
import { SidebarOrgSwitcher } from '#/routes/d/-components/sidebar-org-switcher';

export const sidebarAsideClassName =
  'app-sidebar-surface hidden w-56 shrink-0 flex-col md:flex';

export const navRowClassName =
  'flex h-[var(--app-density-row-height,1.75rem)] w-full min-w-0 items-center gap-2 rounded-md px-2 text-[length:var(--app-font-size-ui,12px)] font-normal outline-hidden transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset';

export const SidebarAccount = (): ReactElement | null => {
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

export const SidebarChrome = ({ nav }: { nav: ReactNode }): ReactElement => (
  <div className="flex h-full min-h-0 flex-col pt-3">
    <div className="mb-3 px-2">
      <SidebarOrgSwitcher />
    </div>
    {nav}
    <SidebarAccount />
  </div>
);

export const MobileSidebarChrome = ({
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
