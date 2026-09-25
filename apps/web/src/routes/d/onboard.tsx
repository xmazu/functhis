import { normalizeOrganizationSlug } from '@functhis/publish/org-slug';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '#/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { authClient } from '#/lib/auth/auth-client';

const OnboardPage = () => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async (): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      const slug = normalizeOrganizationSlug(trimmed);
      const { data, error } = await authClient.organization.create({
        name: trimmed,
        slug,
      });
      if (error || !data?.id) {
        toast.error(error?.message ?? 'Unable to create workspace');
        setIsSubmitting(false);
        return;
      }
      await authClient.organization.setActive({
        organizationId: data.id,
      });
      window.location.assign('/d');
    } catch {
      toast.error('Unable to create workspace');
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="p-4">
        <CardTitle className="text-[length:var(--app-font-size-ui,12px)] font-medium">
          Name your workspace
        </CardTitle>
        <CardDescription className="text-[length:var(--app-font-size-ui,12px)]">
          Packages, billing, and usage live on a workspace. You can create more
          later or join one through an invite.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleContinue();
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              autoComplete="organization"
              autoFocus
              id="workspace-name"
              onChange={(event) => {
                setName(event.currentTarget.value);
              }}
              placeholder="Acme tools"
              required
              value={name}
            />
          </div>
          <Button
            className="w-full"
            disabled={name.trim().length === 0 || isSubmitting}
            type="submit"
          >
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export const Route = createFileRoute('/d/onboard')({
  component: OnboardPage,
});
