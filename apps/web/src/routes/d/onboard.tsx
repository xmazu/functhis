import { normalizeOrganizationSlug } from '@functhis/publish/org-slug';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { zodOnSubmit } from '#/lib/form/zod-on-submit';

const onboardSchema = z.object({
  name: z.string().trim().min(1),
});

const OnboardPage = () => {
  const form = useForm({
    defaultValues: { name: '' },
    validators: {
      onSubmit: zodOnSubmit(onboardSchema),
    },
    onSubmit: async ({ value }) => {
      const trimmed = value.name.trim();
      try {
        const slug = normalizeOrganizationSlug(trimmed);
        const { data: created, error } = await authClient.organization.create({
          name: trimmed,
          slug,
        });
        if (error || !created?.id) {
          toast.error(error?.message ?? 'Unable to create workspace');
          return;
        }
        await authClient.organization.setActive({
          organizationId: created.id,
        });
        window.location.assign('/d');
      } catch {
        toast.error('Unable to create workspace');
      }
    },
  });

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
            void form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input
                  autoComplete="organization"
                  autoFocus
                  id="workspace-name"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  placeholder="Acme tools"
                  required
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
          <form.Subscribe
            selector={(state) => ({
              isSubmitting: state.isSubmitting,
              name: state.values.name,
            })}
          >
            {({ isSubmitting, name }) => (
              <Button
                className="w-full"
                disabled={name.trim().length === 0 || isSubmitting}
                type="submit"
              >
                Continue
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
};

export const Route = createFileRoute('/d/onboard')({
  component: OnboardPage,
});
