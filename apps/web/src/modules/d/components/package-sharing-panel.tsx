import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactElement } from 'react';

import {
  SectionHeading,
  packageDetailUiClass,
} from '#/modules/d/components/package-detail-primitives';
import { Button } from '#/modules/d/components/ui/button';
import { Input } from '#/modules/d/components/ui/input';
import { Label } from '#/modules/d/components/ui/label';
import { updatePackageSharingForSession } from '#/modules/d/server/packages';

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
  const [visibility, setVisibility] = useState(initialVisibility);
  const [organizationSlug, setOrganizationSlug] = useState(
    initialOrganizationSlug
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSaveSharing = async (): Promise<void> => {
    setSaveError(null);
    setSaved(false);
    try {
      await updatePackageSharingForSession({
        data: {
          handle,
          organizationSlug:
            organizationSlug.trim().length > 0
              ? organizationSlug.trim()
              : undefined,
          packageSlug,
          visibility,
        },
      });
      setSaved(true);
      await router.invalidate();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Save failed');
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
