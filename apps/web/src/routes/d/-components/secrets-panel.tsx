import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { messageFromUnknown } from '#/lib/errors/dashboard';
import {
  SectionHeading,
  packageDetailUiClass,
} from '#/routes/d/-components/package-detail-primitives';

export interface SecretListItem {
  name: string;
  updatedAt: Date | string;
}

const EMPTY_MISSING_NAMES: string[] = [];

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
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [replacing, setReplacing] = useState<string | null>(null);
  const [replaceValue, setReplaceValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const run = async (task: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setSaveError(null);
    try {
      await task();
      setName('');
      setValue('');
      setReplacing(null);
      setReplaceValue('');
    } catch (error) {
      setSaveError(messageFromUnknown(error));
    }
    setBusy(false);
  };

  const handleCreate = (event: FormEvent): void => {
    event.preventDefault();
    if (name.trim().length === 0 || value.length === 0) {
      return;
    }
    void run(() => onSet(name.trim(), value));
  };

  return (
    <section className="flex max-w-md flex-col gap-2">
      <SectionHeading>{heading}</SectionHeading>
      <p className={`${ui} text-muted-foreground`}>
        Values are write-only. Set a new value to replace one.
      </p>
      {secrets.length === 0 ? (
        <p className={`${ui} text-muted-foreground`}>No secrets set.</p>
      ) : (
        <ul className="flex flex-col">
          {secrets.map((secret) => (
            <li
              className="border-border flex flex-col gap-1 border-b py-2 last:border-b-0"
              key={secret.name}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`${ui} font-mono`}>{secret.name}</span>
                {canWrite ? (
                  <div className="flex gap-1">
                    <Button
                      disabled={busy}
                      onClick={() => {
                        setReplacing(secret.name);
                        setReplaceValue('');
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Replace
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => {
                        void run(() => onDelete(secret.name));
                      }}
                      size="sm"
                      variant="destructive-outline"
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>
              {canWrite && replacing === secret.name ? (
                <form
                  className="flex flex-col gap-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (replaceValue.length === 0) {
                      return;
                    }
                    void run(() => onSet(secret.name, replaceValue));
                  }}
                >
                  <Label htmlFor={`replace-${secret.name}`}>New value</Label>
                  <Input
                    autoComplete="new-password"
                    id={`replace-${secret.name}`}
                    onChange={(event) => {
                      setReplaceValue(event.target.value);
                    }}
                    type="password"
                    value={replaceValue}
                  />
                  <Button
                    disabled={busy || replaceValue.length === 0}
                    size="sm"
                    type="submit"
                  >
                    Save replacement
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {missingNames.length > 0 ? (
        <p className={`${ui} text-muted-foreground`}>
          Declared in this version, not set: {missingNames.join(', ')}
        </p>
      ) : null}
      {canWrite ? (
        <form className="flex flex-col gap-2" onSubmit={handleCreate}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="secret-name">Name</Label>
            <Input
              autoComplete="off"
              id="secret-name"
              onChange={(event) => {
                setName(event.target.value);
              }}
              placeholder="API_KEY"
              value={name}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="secret-value">Value</Label>
            <Input
              autoComplete="new-password"
              id="secret-value"
              onChange={(event) => {
                setValue(event.target.value);
              }}
              type="password"
              value={value}
            />
          </div>
          {saveError ? (
            <p className={`${ui} text-destructive`}>{saveError}</p>
          ) : null}
          <Button
            disabled={busy || name.trim().length === 0 || value.length === 0}
            size="sm"
            type="submit"
          >
            Set secret
          </Button>
        </form>
      ) : null}
    </section>
  );
};
