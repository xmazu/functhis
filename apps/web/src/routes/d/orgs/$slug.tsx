import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { authClient } from '#/lib/auth/auth-client';
import { useOrgSecretsDashboardQuery } from '#/lib/query/dashboard-cache';
import type { OrgSecretsQueryData } from '#/lib/query/dashboard-cache';
import { dashboardKeys } from '#/lib/query/dashboard-keys';
import { runOptimistic } from '#/lib/query/optimistic';
import { useAppQueryClient } from '#/lib/query/use-app-query-client';
import { SecretsPanel } from '#/routes/d/-components/secrets-panel';
import { invitationIdFromInviteResponse } from '#/routes/d/-lib/organization-invite';
import { getOrgBillingSummary } from '#/routes/d/-server/org-billing';
import {
  deleteOrgSecretForSession,
  listOrgSecretsForSession,
  setOrgSecretForSession,
} from '#/routes/d/-server/secrets';

const inviteAcceptUrl = (invitationId: string): string =>
  `${globalThis.location.origin}/d/accept-invitation/${invitationId}`;

type BillingSummary = Awaited<ReturnType<typeof getOrgBillingSummary>>;
type OrgSecrets = Awaited<ReturnType<typeof listOrgSecretsForSession>>;

const patchOrgSecrets = (
  data: OrgSecretsQueryData,
  name: string,
  mode: 'delete' | 'set'
): OrgSecretsQueryData => {
  if (mode === 'delete') {
    return {
      ...data,
      secrets: data.secrets.filter((secret) => secret.name !== name),
    };
  }
  const now = new Date();
  const without = data.secrets.filter((secret) => secret.name !== name);
  return {
    ...data,
    secrets: [...without, { name, updatedAt: now }].toSorted((a, b) =>
      a.name.localeCompare(b.name)
    ),
  };
};

const BillingActions = ({
  billing,
  billingBusy,
  onManageBilling,
  onUpgrade,
}: {
  billing: NonNullable<BillingSummary>;
  billingBusy: boolean;
  onManageBilling: () => void;
  onUpgrade: () => void;
}) => {
  if (!billing.billingEnabled) {
    return (
      <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
        Stripe billing is not configured in this environment.
      </p>
    );
  }

  if (!billing.canManageBilling) {
    return (
      <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
        Only workspace owners and admins can change billing.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {billing.plan === 'free' ? (
        <Button disabled={billingBusy} onClick={onUpgrade} size="sm">
          Upgrade to Pro
        </Button>
      ) : null}
      <Button
        disabled={billingBusy}
        onClick={onManageBilling}
        size="sm"
        variant="outline"
      >
        Manage billing
      </Button>
    </div>
  );
};

const OrganizationDetailPage = () => {
  const { slug } = Route.useParams();
  const queryClient = useAppQueryClient();
  const { data: organizations } = authClient.useListOrganizations();
  const organization = (organizations ?? []).find((org) => org.slug === slug);
  const organizationId = organization?.id ?? '';
  const [members, setMembers] = useState<
    { email: string; id: string; role: string; userId: string }[]
  >([]);
  const [billing, setBilling] = useState<BillingSummary>(null);
  const [secrets, setSecrets] = useState<OrgSecrets>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const secretsView = useOrgSecretsDashboardQuery(organizationId, secrets);
  const secretsKey = dashboardKeys.orgSecrets(organizationId);

  useEffect(() => {
    if (!organization?.id) {
      return;
    }
    const load = async (): Promise<void> => {
      const [{ data: memberData }, summary, secretList] = await Promise.all([
        authClient.organization.listMembers({
          query: {
            organizationId: organization.id,
          },
        }),
        getOrgBillingSummary({ data: { organizationId: organization.id } }),
        listOrgSecretsForSession({
          data: { organizationId: organization.id },
        }),
      ]);
      if (memberData) {
        setMembers(
          memberData.members.map((memberRow) => ({
            email: memberRow.user.email,
            id: memberRow.id,
            role: memberRow.role,
            userId: memberRow.userId,
          }))
        );
      }
      setBilling(summary);
      setSecrets(secretList);
    };
    void load();
  }, [organization?.id]);

  const handleUpgrade = async (): Promise<void> => {
    if (!organization?.id) {
      return;
    }
    setBillingBusy(true);
    const returnUrl = globalThis.location.href;
    const { error: upgradeError } = await authClient.subscription.upgrade({
      cancelUrl: returnUrl,
      customerType: 'organization',
      disableRedirect: false,
      plan: 'pro',
      referenceId: organization.id,
      successUrl: returnUrl,
    });
    if (upgradeError) {
      setError(upgradeError.message ?? 'Unable to start checkout');
      setBillingBusy(false);
    }
  };

  const handleManageBilling = async (): Promise<void> => {
    if (!organization?.id) {
      return;
    }
    setBillingBusy(true);
    const { data, error: portalError } =
      await authClient.subscription.billingPortal({
        customerType: 'organization',
        referenceId: organization.id,
        returnUrl: globalThis.location.href,
      });
    if (portalError) {
      setError(portalError.message ?? 'Unable to open billing portal');
      setBillingBusy(false);
      return;
    }
    if (data?.url) {
      globalThis.location.assign(data.url);
    }
    setBillingBusy(false);
  };

  const handleInvite = async (): Promise<void> => {
    if (!organization?.id) {
      return;
    }
    setError(null);
    setInviteLink(null);
    const { data, error: inviteError } =
      await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        organizationId: organization.id,
        role: 'member',
      });
    if (inviteError) {
      setError(inviteError.message ?? 'Invite failed');
      return;
    }
    const invitationId = invitationIdFromInviteResponse(data);
    if (invitationId) {
      setInviteLink(inviteAcceptUrl(invitationId));
    }
    setInviteEmail('');
  };

  if (!organization) {
    return (
      <main className="flex min-h-0 flex-1 flex-col p-4">
        <p className="text-[length:var(--app-font-size-ui,12px)]">
          Organization not found.
        </p>
        <Link
          className="mt-2 text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
          to="/d/orgs"
        >
          Back to organizations
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 py-2.5">
        <h1 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
          {organization.name}
        </h1>
        <p className="text-muted-foreground font-mono text-[length:var(--app-font-size-ui,12px)]">
          {organization.slug}
        </p>
      </header>
      <div className="flex flex-col gap-4 p-4">
        {billing ? (
          <section className="flex max-w-md flex-col gap-2 border p-3">
            <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
              Billing
            </h2>
            <p className="text-[length:var(--app-font-size-ui,12px)]">
              Plan: {billing.plan === 'pro' ? 'Pro' : 'Free'}
            </p>
            <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
              {billing.packageCount} / {billing.limits.maxPackages} packages ·{' '}
              {billing.executionCount} / {billing.limits.maxExecutionsPerMonth}{' '}
              executions this month
            </p>
            <BillingActions
              billing={billing}
              billingBusy={billingBusy}
              onManageBilling={() => {
                void handleManageBilling();
              }}
              onUpgrade={() => {
                void handleUpgrade();
              }}
            />
          </section>
        ) : null}
        {secretsView ? (
          <div className="max-w-md border p-3">
            <SecretsPanel
              canWrite={secretsView.canWrite}
              heading="Secrets"
              onDelete={async (name) => {
                if (!organization.id) {
                  return;
                }
                await runOptimistic(
                  queryClient,
                  [
                    {
                      queryKey: secretsKey,
                      updater: (previous) => {
                        if (!previous || typeof previous !== 'object') {
                          return previous;
                        }
                        return patchOrgSecrets(
                          previous as OrgSecretsQueryData,
                          name,
                          'delete'
                        );
                      },
                    },
                  ],
                  async () => {
                    await deleteOrgSecretForSession({
                      data: { name, organizationId: organization.id },
                    });
                    const next = await listOrgSecretsForSession({
                      data: { organizationId: organization.id },
                    });
                    setSecrets(next);
                    if (next) {
                      queryClient.setQueryData(secretsKey, next);
                    }
                  },
                  { invalidateOnSuccess: false }
                );
              }}
              onSet={async (name, value) => {
                await runOptimistic(
                  queryClient,
                  [
                    {
                      queryKey: secretsKey,
                      updater: (previous) => {
                        if (!previous || typeof previous !== 'object') {
                          return previous;
                        }
                        return patchOrgSecrets(
                          previous as OrgSecretsQueryData,
                          name,
                          'set'
                        );
                      },
                    },
                  ],
                  async () => {
                    await setOrgSecretForSession({
                      data: {
                        name,
                        organizationId: organization.id,
                        value,
                      },
                    });
                    const next = await listOrgSecretsForSession({
                      data: { organizationId: organization.id },
                    });
                    setSecrets(next);
                    if (next) {
                      queryClient.setQueryData(secretsKey, next);
                    }
                  },
                  { invalidateOnSuccess: false }
                );
              }}
              secrets={secretsView.secrets}
            />
          </div>
        ) : null}
        <section className="flex max-w-md flex-col gap-2 border p-3">
          <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Invite member
          </h2>
          <div className="flex flex-col gap-1">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              onChange={(event) => {
                setInviteEmail(event.target.value);
              }}
              type="email"
              value={inviteEmail}
            />
          </div>
          {error ? (
            <p className="text-destructive text-[length:var(--app-font-size-ui,12px)]">
              {error}
            </p>
          ) : null}
          {inviteLink ? (
            <p className="font-mono text-[11px] leading-relaxed break-all">
              Share this link: {inviteLink}
            </p>
          ) : null}
          <Button
            disabled={inviteEmail.trim().length === 0}
            onClick={() => {
              void handleInvite();
            }}
            size="sm"
          >
            Invite member
          </Button>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Members
          </h2>
          <ul className="flex flex-col gap-1">
            {members.map((member) => (
              <li
                className="text-[length:var(--app-font-size-ui,12px)]"
                key={member.id}
              >
                {member.email} · {member.role}
              </li>
            ))}
          </ul>
        </section>
        <Link
          className="text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
          to="/d/orgs"
        >
          Back to organizations
        </Link>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/d/orgs/$slug')({
  component: OrganizationDetailPage,
});
