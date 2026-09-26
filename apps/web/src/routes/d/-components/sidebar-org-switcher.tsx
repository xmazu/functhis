import { IconCheck, IconChevronDown, IconPlus } from '@tabler/icons-react';
import { Link, getRouteApi, useRouter } from '@tanstack/react-router';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu';
import { authClient } from '#/lib/auth/auth-client';
import { cn } from '#/lib/utils';

const dRouteApi = getRouteApi('/d');

const triggerClassName =
  'flex h-[var(--app-density-row-height,1.75rem)] w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[length:var(--app-font-size-ui,12px)] font-medium outline-hidden transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset data-popup-open:bg-sidebar-accent';

export const SidebarOrgSwitcher = ({ className }: { className?: string }) => {
  const router = useRouter();
  const { activeOrganizationId, organizations } = dRouteApi.useLoaderData();

  const effectiveActiveId =
    activeOrganizationId ?? organizations[0]?.id ?? null;
  const activeOrg =
    organizations.find((org) => org.id === effectiveActiveId) ?? null;

  const label = activeOrg?.name ?? 'Organization';

  const handleSelect = async (organizationId: string): Promise<void> => {
    if (organizationId === effectiveActiveId) {
      return;
    }
    await authClient.organization.setActive({ organizationId });
    await router.invalidate();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(triggerClassName, className)}>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <IconChevronDown className="size-3.5 shrink-0 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48" sideOffset={2}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          {organizations.length === 0 ? (
            <DropdownMenuItem disabled>
              <span className="text-muted-foreground">
                No organizations yet
              </span>
            </DropdownMenuItem>
          ) : (
            organizations.map((org) => {
              const isActive = org.id === effectiveActiveId;

              return (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => {
                    void handleSelect(org.id);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{org.name}</span>
                  {isActive ? (
                    <IconCheck className="size-3.5 shrink-0 opacity-80" />
                  ) : null}
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={
              <Link className="flex w-full items-center gap-2" to="/d/orgs" />
            }
          >
            <IconPlus className="size-3.5 shrink-0 opacity-80" />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
