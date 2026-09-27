import { normalizeOrganizationSlug } from '@functhis/publish/org-slug';
import { useForm } from '@tanstack/react-form';
import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';

import { Button } from '#/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogPopup,
  DialogTitle,
} from '#/components/ui/dialog';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { authClient } from '#/lib/auth/auth-client';
import { messageFromUnknown } from '#/lib/errors/dashboard';
import { zodOnSubmit } from '#/lib/form/zod-on-submit';

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string(),
});

export const CreateOrganizationDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: '', slug: '' },
    validators: {
      onSubmit: zodOnSubmit(createOrganizationSchema),
    },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        const { error: createError } = await authClient.organization.create({
          name: value.name.trim(),
          slug: value.slug.trim() || normalizeOrganizationSlug(value.name),
        });
        if (createError) {
          setError(createError.message ?? 'Failed to create organization');
          return;
        }
        form.reset();
        onOpenChange(false);
        await router.invalidate();
      } catch (createError) {
        setError(messageFromUnknown(createError));
      }
    },
  });

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          form.reset();
          setError(null);
        }
      }}
      open={open}
    >
      <DialogPopup>
        <DialogTitle>Create organization</DialogTitle>
        <DialogDescription>
          Create a workspace for packages, secrets, and usage.
        </DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="create-org-name">Name</Label>
                <Input
                  id="create-org-name"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    field.handleChange(nextName);
                    if (!form.getFieldValue('slug')) {
                      form.setFieldValue(
                        'slug',
                        normalizeOrganizationSlug(nextName)
                      );
                    }
                  }}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="slug">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="create-org-slug">Slug</Label>
                <Input
                  id="create-org-slug"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
          {error ? (
            <p className="text-destructive text-[length:var(--app-font-size-ui,12px)]">
              {error}
            </p>
          ) : null}
          <form.Subscribe
            selector={(state) => ({
              isSubmitting: state.isSubmitting,
              name: state.values.name,
            })}
          >
            {({ isSubmitting, name }) => (
              <Button
                disabled={isSubmitting || name.trim().length === 0}
                size="sm"
                type="submit"
              >
                {isSubmitting ? 'Creating…' : 'Create organization'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </DialogPopup>
    </Dialog>
  );
};
