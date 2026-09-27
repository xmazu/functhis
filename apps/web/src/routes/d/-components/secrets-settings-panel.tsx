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
  Dialog,
  DialogDescription,
  DialogPopup,
  DialogTitle,
} from '#/components/ui/dialog';
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
import { settingsText } from '#/routes/d/-components/settings/settings-primitives';
import { formatSecretActivityDate } from '#/routes/d/-lib/secret-dates';
import type { SecretListItem } from '#/routes/d/-lib/secret-dates';

const createSecretSchema = z.object({
  name: z.string().trim().min(1),
  value: z.string().min(1),
});

const replaceSecretSchema = z.object({
  value: z.string().min(1),
});

export const SecretsSettingsPanel = ({
  canWrite,
  createOpen,
  onCreateOpenChange,
  onDelete,
  onSet,
  secrets,
}: {
  canWrite: boolean;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onDelete: (name: string) => Promise<void>;
  onSet: (name: string, value: string) => Promise<void>;
  secrets: SecretListItem[];
}): ReactElement => {
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceName, setReplaceName] = useState<string | null>(null);
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
      if (!replaceName) {
        return;
      }
      await runRef.current(() => onSet(replaceName, value.value));
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
        setReplaceName(null);
        onCreateOpenChange(false);
        setReplaceOpen(false);
      } catch (error) {
        setSaveError(messageFromUnknown(error));
      }
      setBusy(false);
    },
    [createForm, onCreateOpenChange, replaceForm]
  );

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const openCreateDialog = (): void => {
    setSaveError(null);
    createForm.reset();
    onCreateOpenChange(true);
  };

  return (
    <>
      <p
        className={`${settingsText} rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-amber-200/90`}
      >
        Values are write-only and encrypted. Set a new value to replace a
        secret, rotate any secret you suspect was exposed.
      </p>

      {secrets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
          <IconKey className="text-muted-foreground size-5" />
          <p className={`${settingsText} font-medium`}>No secrets set</p>
          <p className={`${settingsText} text-muted-foreground`}>
            Add runtime values your deployed functions can read.
          </p>
          {canWrite ? (
            <Button
              className="mt-2"
              onClick={openCreateDialog}
              size="sm"
              variant="outline"
            >
              <IconPlus />
              New secret
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.03]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableHead
                  className={`${settingsText} text-muted-foreground h-[var(--app-density-row-height,1.75rem)] ps-3`}
                >
                  Name
                </TableHead>
                <TableHead
                  className={`${settingsText} text-muted-foreground h-[var(--app-density-row-height,1.75rem)]`}
                >
                  Last used
                </TableHead>
                <TableHead
                  className={`${settingsText} text-muted-foreground h-[var(--app-density-row-height,1.75rem)]`}
                >
                  Updated
                </TableHead>
                {canWrite ? (
                  <TableHead
                    aria-label="Actions"
                    className="h-[var(--app-density-row-height,1.75rem)] w-px pe-3"
                  />
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow className="border-white/8" key={secret.name}>
                  <TableCell className={`${settingsText} ps-3 font-medium`}>
                    <div className="flex items-center gap-2">
                      <IconKey className="text-muted-foreground size-3.5" />
                      <span className="font-mono">{secret.name}</span>
                    </div>
                  </TableCell>
                  <TableCell
                    className={`${settingsText} text-muted-foreground tabular-nums`}
                  >
                    {formatSecretActivityDate(secret.lastUsedAt)}
                  </TableCell>
                  <TableCell
                    className={`${settingsText} text-muted-foreground tabular-nums`}
                  >
                    {formatSecretActivityDate(secret.updatedAt)}
                  </TableCell>
                  {canWrite ? (
                    <TableCell className="pe-3">
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
                              setSaveError(null);
                              setReplaceName(secret.name);
                              replaceForm.reset({ value: '' });
                              setReplaceOpen(true);
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

      <Dialog
        onOpenChange={(open) => {
          onCreateOpenChange(open);
          if (!open) {
            createForm.reset();
            setSaveError(null);
          }
        }}
        open={createOpen}
      >
        <DialogPopup>
          <DialogTitle>New secret</DialogTitle>
          <DialogDescription>
            The value is encrypted and never shown again after you save.
          </DialogDescription>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createForm.handleSubmit();
            }}
          >
            <createForm.Field name="name">
              {(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="settings-secret-name">Name</Label>
                  <Input
                    autoComplete="off"
                    id="settings-secret-name"
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    placeholder="API_KEY"
                    value={field.state.value}
                  />
                </div>
              )}
            </createForm.Field>
            <createForm.Field name="value">
              {(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="settings-secret-value">Value</Label>
                  <Input
                    autoComplete="new-password"
                    id="settings-secret-value"
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
              <p className={`${settingsText} text-destructive`}>{saveError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                disabled={busy}
                onClick={() => {
                  onCreateOpenChange(false);
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
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
                    type="submit"
                  >
                    Save secret
                  </Button>
                )}
              </createForm.Subscribe>
            </div>
          </form>
        </DialogPopup>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          setReplaceOpen(open);
          if (!open) {
            setReplaceName(null);
            replaceForm.reset();
            setSaveError(null);
          }
        }}
        open={replaceOpen}
      >
        <DialogPopup>
          <DialogTitle>Replace secret</DialogTitle>
          <DialogDescription>
            {replaceName
              ? `Set a new value for ${replaceName}. The previous value is discarded.`
              : 'Set a new value for this secret.'}
          </DialogDescription>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void replaceForm.handleSubmit();
            }}
          >
            <replaceForm.Field name="value">
              {(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="settings-replace-secret-value">
                    New value
                  </Label>
                  <Input
                    autoComplete="new-password"
                    id="settings-replace-secret-value"
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
            </replaceForm.Field>
            {saveError ? (
              <p className={`${settingsText} text-destructive`}>{saveError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                disabled={busy}
                onClick={() => {
                  setReplaceOpen(false);
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <replaceForm.Subscribe selector={(state) => state.values.value}>
                {(value) => (
                  <Button disabled={busy || value.length === 0} type="submit">
                    Save secret
                  </Button>
                )}
              </replaceForm.Subscribe>
            </div>
          </form>
        </DialogPopup>
      </Dialog>
    </>
  );
};
