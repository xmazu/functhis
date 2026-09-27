import {
  IconDots,
  IconKey,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { useForm } from '@tanstack/react-form';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { Button } from '#/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table';
import { messageFromUnknown } from '#/lib/errors/dashboard';
import { zodOnSubmit } from '#/lib/form/zod-on-submit';
import {
  SectionHeading,
  packageDetailUiClass,
} from '#/routes/d/-components/package-detail-primitives';
import { formatSecretActivityDate } from '#/routes/d/-lib/secret-dates';
import type { SecretListItem } from '#/routes/d/-lib/secret-dates';

export type { SecretListItem } from '#/routes/d/-lib/secret-dates';

const EMPTY_MISSING_NAMES: string[] = [];

const createSecretSchema = z.object({
  name: z.string().trim().min(1),
  value: z.string().min(1),
});

const replaceSecretSchema = z.object({
  value: z.string().min(1),
});

export const SecretsPanel = ({
  canWrite,
  heading,
  missingNames = EMPTY_MISSING_NAMES,
  onDelete,
  onSet,
  secrets,
}: {
  canWrite: boolean;
  heading: string;
  missingNames?: string[];
  onDelete: (name: string) => Promise<void>;
  onSet: (name: string, value: string) => Promise<void>;
  secrets: SecretListItem[];
}): ReactElement => {
  const ui = packageDetailUiClass;
  const secretNameInputRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const runRef = useRef<(task: () => Promise<void>) => Promise<void>>(
    async () => {
      await Promise.resolve();
    }
  );

  const createForm = useForm({
    defaultValues: { name: '', value: '' },
    validators: {
      onSubmit: zodOnSubmit(createSecretSchema),
    },
    onSubmit: async ({ value }) => {
      await runRef.current(() => onSet(value.name.trim(), value.value));
    },
  });

  const replaceForm = useForm({
    defaultValues: { value: '' },
    validators: {
      onSubmit: zodOnSubmit(replaceSecretSchema),
    },
    onSubmit: async ({ value }) => {
      if (!replacing) {
        return;
      }
      await runRef.current(() => onSet(replacing, value.value));
    },
  });

  const run = useCallback(
    async (task: () => Promise<void>): Promise<void> => {
      setBusy(true);
      setSaveError(null);
      try {
        await task();
        createForm.reset();
        replaceForm.reset();
        setReplacing(null);
      } catch (error) {
        setSaveError(messageFromUnknown(error));
      }
      setBusy(false);
    },
    [createForm, replaceForm]
  );

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <SectionHeading>{heading}</SectionHeading>
          <p className={`${ui} text-muted-foreground mt-1`}>
            Values are write-only. Set a new value to replace one.
          </p>
        </div>
        {canWrite ? (
          <Button
            onClick={() => {
              secretNameInputRef.current?.focus();
            }}
            size="sm"
          >
            <IconPlus />
            New secret
          </Button>
        ) : null}
      </div>

      {secrets.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
          <IconKey className="text-muted-foreground size-5" />
          <p className={`${ui} font-medium`}>No secrets set</p>
          <p className={`${ui} text-muted-foreground`}>
            Add a runtime value for your deployed functions.
          </p>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-white/[0.025] hover:bg-white/[0.025]">
                <TableHead className={`${ui} px-3`}>Name</TableHead>
                <TableHead className={`${ui} px-3`}>Last used</TableHead>
                <TableHead className={`${ui} px-3`}>Updated</TableHead>
                {canWrite ? (
                  <TableHead aria-label="Actions" className="w-10 px-2" />
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow key={secret.name}>
                  <TableCell className={`${ui} px-3 font-mono font-medium`}>
                    <div className="flex items-center gap-2">
                      <IconKey className="text-muted-foreground size-3.5" />
                      {secret.name}
                    </div>
                    {canWrite && replacing === secret.name ? (
                      <form
                        className="mt-2 flex max-w-sm flex-col gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void replaceForm.handleSubmit();
                        }}
                      >
                        <replaceForm.Field name="value">
                          {(field) => (
                            <>
                              <Label htmlFor={`replace-${secret.name}`}>
                                New value
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  autoComplete="new-password"
                                  className="h-7"
                                  id={`replace-${secret.name}`}
                                  name={field.name}
                                  onBlur={field.handleBlur}
                                  onChange={(event) => {
                                    field.handleChange(event.target.value);
                                  }}
                                  type="password"
                                  value={field.state.value}
                                />
                                <replaceForm.Subscribe
                                  selector={(state) => state.values.value}
                                >
                                  {(value) => (
                                    <Button
                                      disabled={busy || value.length === 0}
                                      size="sm"
                                      type="submit"
                                    >
                                      Save
                                    </Button>
                                  )}
                                </replaceForm.Subscribe>
                              </div>
                            </>
                          )}
                        </replaceForm.Field>
                      </form>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className={`${ui} text-muted-foreground px-3 tabular-nums`}
                  >
                    {formatSecretActivityDate(secret.lastUsedAt)}
                  </TableCell>
                  <TableCell
                    className={`${ui} text-muted-foreground px-3 tabular-nums`}
                  >
                    {formatSecretActivityDate(secret.updatedAt)}
                  </TableCell>
                  {canWrite ? (
                    <TableCell className="px-2 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${secret.name}`}
                          render={
                            <Button
                              aria-label={`Actions for ${secret.name}`}
                              size="icon-sm"
                              variant="ghost"
                            />
                          }
                        >
                          <IconDots />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={busy}
                            onClick={() => {
                              setReplacing(secret.name);
                              replaceForm.reset({ value: '' });
                            }}
                          >
                            <IconRefresh />
                            Replace secret
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={busy}
                            onClick={() => {
                              void run(() => onDelete(secret.name));
                            }}
                            variant="destructive"
                          >
                            <IconTrash />
                            Delete secret
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {missingNames.length > 0 ? (
        <p className={`${ui} text-muted-foreground`}>
          Declared in this version, not set: {missingNames.join(', ')}
        </p>
      ) : null}
      {canWrite ? (
        <form
          className="border-border flex flex-col gap-3 rounded-lg border bg-white/[0.02] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void createForm.handleSubmit();
          }}
        >
          <div>
            <h3 className={`${ui} font-medium`}>Add secret</h3>
            <p className={`${ui} text-muted-foreground mt-1`}>
              The value is encrypted and never shown again.
            </p>
          </div>
          <createForm.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="secret-name">Name</Label>
                <Input
                  autoComplete="off"
                  id="secret-name"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  placeholder="API_KEY"
                  ref={secretNameInputRef}
                  value={field.state.value}
                />
              </div>
            )}
          </createForm.Field>
          <createForm.Field name="value">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="secret-value">Value</Label>
                <Input
                  autoComplete="new-password"
                  id="secret-value"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  type="password"
                  value={field.state.value}
                />
              </div>
            )}
          </createForm.Field>
          {saveError ? (
            <p className={`${ui} text-destructive`}>{saveError}</p>
          ) : null}
          <createForm.Subscribe
            selector={(state) => ({
              name: state.values.name,
              value: state.values.value,
            })}
          >
            {({ name, value }) => (
              <Button
                disabled={
                  busy || name.trim().length === 0 || value.length === 0
                }
                size="sm"
                type="submit"
              >
                Set secret
              </Button>
            )}
          </createForm.Subscribe>
        </form>
      ) : null}
    </section>
  );
};
