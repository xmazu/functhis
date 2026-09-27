import { IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { Button } from '#/components/ui/button';
import { authClient } from '#/lib/auth/auth-client';
import { messageFromUnknown } from '#/lib/errors/dashboard';
import { dashboardKeys } from '#/lib/query/dashboard-keys';
import {
  SettingsEmpty,
  SettingsPage,
  SettingsRow,
  SettingsSection,
  settingsText,
} from '#/routes/d/-components/settings/settings-primitives';
import { getOrgBillingSummary } from '#/routes/d/-server/org-billing';
import { getOrgUsageForSession } from '#/routes/d/-server/org-usage';

const dRouteApi = getRouteApi('/d');
type Usage = Awaited<ReturnType<typeof getOrgUsageForSession>>;

const UsageMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-background/30 flex flex-col gap-1 rounded-lg border px-3 py-2">
    <span className={`${settingsText} text-muted-foreground`}>{label}</span>
    <span className={`${settingsText} font-medium tabular-nums`}>{value}</span>
  </div>
);

const RuntimeActivity = ({ usage }: { usage: Usage }) => {
  if (usage === null) {
    return (
      <SettingsEmpty>
        You do not have access to usage for this organization.
      </SettingsEmpty>
    );
  }
  if (!usage.available) {
    return (
      <SettingsEmpty>
        Analytics Engine usage is unavailable in this environment.
      </SettingsEmpty>
    );
  }
  const { day, month, week } = usage.periods;
  if (month.executions === 0 && week.executions === 0 && day.executions === 0) {
    return <SettingsEmpty>No runtime activity recorded yet.</SettingsEmpty>;
  }

  const content: ReactNode = (
    <>
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
        <UsageMetric
          label="Last 24 hours"
          value={day.executions.toLocaleString()}
        />
        <UsageMetric
          label="Last 7 days"
          value={week.executions.toLocaleString()}
        />
        <UsageMetric
          label="Last 30 days"
          value={month.executions.toLocaleString()}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-2">
        <UsageMetric label="Errors" value={month.errors.toLocaleString()} />
        <UsageMetric
          label="Average duration"
          value={`${Math.round(month.averageDurationMs)} ms`}
        />
      </div>
      <SettingsRow
        description="Activity recorded by the hosted runtime, grouped by function."
        title="Functions"
      >
        <span className={`${settingsText} text-muted-foreground`}>
          {month.functions.length}
        </span>
      </SettingsRow>
      {month.functions.map((functionUsage) => (
        <SettingsRow
          description={`${functionUsage.errors} errors · ${Math.round(functionUsage.averageDurationMs)} ms average`}
          key={functionUsage.name}
          title={functionUsage.name}
        >
          <span className={`${settingsText} tabular-nums`}>
            {functionUsage.executions.toLocaleString()}
          </span>
        </SettingsRow>
      ))}
    </>
  );
  return content;
};

const UsagePage = () => {
  const { activeOrganizationId } = dRouteApi.useLoaderData();
  const { data: organizations } = authClient.useListOrganizations();
  const organizationId = activeOrganizationId ?? organizations?.[0]?.id ?? '';
  const usageQuery = useQuery({
    enabled: organizationId.length > 0,
    queryFn: async () => {
      const [billing, usage] = await Promise.all([
        getOrgBillingSummary({ data: { organizationId } }),
        getOrgUsageForSession({ data: { organizationId } }),
      ]);
      return { billing, usage };
    },
    queryKey: dashboardKeys.orgUsage(organizationId),
  });
  const billing = usageQuery.data?.billing ?? null;
  const usage = usageQuery.data?.usage ?? null;
  const loading = usageQuery.isFetching;
  const error = usageQuery.error ? messageFromUnknown(usageQuery.error) : null;

  const quotaPercent =
    billing && billing.limits.maxExecutionsPerMonth > 0
      ? Math.min(
          100,
          (billing.executionCount / billing.limits.maxExecutionsPerMonth) * 100
        )
      : 0;

  return (
    <SettingsPage
      action={
        <Button
          aria-label="Refresh usage"
          disabled={loading}
          onClick={() => {
            void usageQuery.refetch();
          }}
          size="icon-sm"
          variant="outline"
        >
          <IconRefresh className={loading ? 'animate-spin' : undefined} />
        </Button>
      }
      description="Review execution limits and runtime activity for this organization."
      title="Usage"
    >
      {error ? (
        <p className={`${settingsText} text-destructive px-2`}>{error}</p>
      ) : null}
      <SettingsSection title="Plan usage">
        {billing ? (
          <>
            <SettingsRow
              description={`${billing.executionCount.toLocaleString()} of ${billing.limits.maxExecutionsPerMonth.toLocaleString()} executions this month`}
              title={`${billing.plan === 'pro' ? 'Pro' : 'Free'} plan`}
            >
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full sm:w-48">
                <div
                  className="bg-foreground h-full rounded-full transition-[width]"
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
            </SettingsRow>
            <SettingsRow
              description={`${billing.packageCount} deployed packages`}
              title="Packages"
            />
          </>
        ) : (
          <SettingsEmpty>Loading plan usage…</SettingsEmpty>
        )}
      </SettingsSection>
      <SettingsSection title="Runtime activity">
        <RuntimeActivity usage={usage} />
      </SettingsSection>
    </SettingsPage>
  );
};

export const Route = createFileRoute('/d/settings/usage')({
  component: UsagePage,
});
