import { IconExternalLink } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { ReactElement, ReactNode } from 'react';

import {
  Sheet,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from '#/components/ui/sheet';
import { cn } from '#/lib/utils';
import {
  formatPackageDateTime,
  toPackageIso,
} from '#/routes/d/-lib/package-dates';

interface LogDetailsRow {
  executionId: string;
  functionSlug: string;
  handle: string;
  level: string;
  message: string;
  packageSlug: string;
  timestamp: string;
  versionId: string;
}

interface LogDetailsPayload {
  input: string | null;
  output: string | null;
}

const levelClassName = (level: string): string => {
  if (level === 'error') {
    return 'text-destructive';
  }
  if (level === 'warn' || level === 'warning') {
    return 'text-warning';
  }
  return 'text-muted-foreground';
};

const MetaItem = ({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}): ReactElement => (
  <div>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-mono break-all">{children}</dd>
  </div>
);

const CodeBlock = ({ children }: { children: string }): ReactElement => (
  <pre className="bg-muted overflow-x-auto p-3 font-mono break-words whitespace-pre-wrap">
    {children}
  </pre>
);

export const LogDetailsSheet = ({
  onOpenChange,
  payload,
  selected,
}: {
  onOpenChange: (open: boolean) => void;
  payload: LogDetailsPayload | null;
  selected: LogDetailsRow | null;
}): ReactElement => (
  <Sheet onOpenChange={onOpenChange} open={selected !== null}>
    <SheetPopup side="right">
      <SheetHeader>
        <SheetTitle>Log details</SheetTitle>
      </SheetHeader>
      <SheetPanel className="flex flex-col gap-6" scrollFade={false}>
        {selected ? (
          <>
            <div className="flex h-[var(--app-density-row-height,1.75rem)] items-center gap-3">
              <span
                className={cn('font-medium', levelClassName(selected.level))}
              >
                {selected.level}
              </span>
              <time
                className="text-muted-foreground tabular-nums"
                dateTime={toPackageIso(selected.timestamp)}
              >
                {formatPackageDateTime(selected.timestamp)}
              </time>
            </div>
            <CodeBlock>{selected.message}</CodeBlock>
            <dl className="grid gap-3">
              <MetaItem label="Package">
                @{selected.handle}/{selected.packageSlug}
              </MetaItem>
              <MetaItem label="Function">{selected.functionSlug}</MetaItem>
              <MetaItem label="Version">{selected.versionId}</MetaItem>
            </dl>
            {payload?.input ? (
              <section>
                <h2 className="mb-2 font-medium">Input</h2>
                <CodeBlock>{payload.input}</CodeBlock>
              </section>
            ) : null}
            {payload?.output ? (
              <section>
                <h2 className="mb-2 font-medium">Output</h2>
                <CodeBlock>{payload.output}</CodeBlock>
              </section>
            ) : null}
          </>
        ) : null}
      </SheetPanel>
      {selected ? (
        <SheetFooter variant="bare">
          <Link
            className="text-foreground/80 hover:text-foreground inline-flex items-center gap-1 sm:me-auto"
            params={{
              executionId: selected.executionId,
              handle: selected.handle,
              slug: selected.packageSlug,
            }}
            to="/@{$handle}/$slug/executions/$executionId"
          >
            View execution
            <IconExternalLink className="size-3.5" />
          </Link>
        </SheetFooter>
      ) : null}
    </SheetPopup>
  </Sheet>
);
