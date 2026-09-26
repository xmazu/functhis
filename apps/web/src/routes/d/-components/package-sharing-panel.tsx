import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { messageFromUnknown } from '#/lib/errors/dashboard';
import { dashboardKeys } from '#/lib/query/dashboard-keys';
import { runOptimistic } from '#/lib/query/optimistic';
import { useAppQueryClient } from '#/lib/query/use-app-query-client';
import {
  SectionHeading,
  packageDetailUiClass,
} from '#/routes/d/-components/package-detail-primitives';
import type { PackageDetailViewModel } from '#/routes/d/-server/package-detail-view-model';
import { updatePackageSharingForSession } from '#/routes/d/-server/packages';

const VISIBILITY_OPTIONS = ['private', 'organization'] as const;
const VISIBILITY_LABEL: Record<(typeof VISIBILITY_OPTIONS)[number], string> = {
  organization: 'Organization',
  private: 'Private',
};

export const PackageSharingPanel = ({
  handle,
  initialOrganizationSlug,
  initialVisibility,
  organizationSlugs,
  packageSlug,
}: {
  handle: string;
  initialOrganizationSlug: string;
  initialVisibility: (typeof VISIBILITY_OPTIONS)[number];
  organizationSlugs: string[];
  packageSlug: string;
}): ReactElement => {
  const ui = packageDetailUiClass;
  const router = useRouter();
  const queryClient = useAppQueryClient();
  const [visibility, setVisibility] = useState(initialVisibility);
  const [organizationSlug, setOrganizationSlug] = useState(
    initialOrganizationSlug
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSaveSharing = async (): Promise<void> => {
    setSaveError(null);
    setSaved(false);
    const trimmedOrgSlug =
      organizationSlug.trim().length > 0 ? organizationSlug.trim() : undefined;
    const detailKey = dashboardKeys.packageDetail(handle, packageSlug);

    try {
      await runOptimistic(
        queryClient,
        [
          {
            queryKey: detailKey,
            updater: (previous) => {
              if (!previous || typeof previous !== 'object') {
                return previous;
              }
              const detail = previous as PackageDetailViewModel;
              return {
                ...detail,
                organizationSlug: trimmedOrgSlug ?? detail.organizationSlug,
                visibility,
              };
            },
          },
        ],
        async () => {
          await updatePackageSharingForSession({
            data: {
              handle,
              organizationSlug: trimmedOrgSlug,
              packageSlug,
              visibility,
            },
          });
          await router.invalidate();
        },
        { invalidateOnSuccess: false }
      );
      setSaved(true);
    } catch (error) {
      setSaveError(messageFromUnknown(error));
    }
  };

  return (
    <section>
      <SectionHeading>Sharing</SectionHeading>
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="visibility">Visibility</Label>
          <select
            className={`${ui} border-input bg-input focus-visible:ring-ring/60 h-8 w-full rounded-lg border px-2 outline-none focus-visible:ring-1`}
            id="visibility"
            onChange={(event) => {
              setVisibility(
                event.target.value as (typeof VISIBILITY_OPTIONS)[number]
              );
            }}
            value={visibility}
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {VISIBILITY_LABEL[option]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="organization">Organization slug</Label>
          <Input
            id="organization"
            onChange={(event) => {
              setOrganizationSlug(event.target.value);
            }}
            placeholder="Required for organization visibility"
            value={organizationSlug}
          />
          {organizationSlugs.length > 0 ? (
            <p className={`${ui} text-muted-foreground`}>
              Your orgs: {organizationSlugs.join(', ')}
            </p>
          ) : null}
        </div>
        {saveError ? (
          <p className={`${ui} text-destructive`}>{saveError}</p>
        ) : null}
        {saved ? <p className={ui}>Saved.</p> : null}
        <Button
          onClick={() => {
            void handleSaveSharing();
          }}
          size="sm"
        >
          Save sharing
        </Button>
      </div>
    </section>
  );
};
