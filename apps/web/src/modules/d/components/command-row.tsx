import type { ReactElement } from 'react';

import { CopyButton } from '#/modules/d/components/copy-button';

export const CommandRow = ({
  command,
  label,
  prompt = '$',
}: {
  command: string;
  label: string;
  prompt?: string;
}): ReactElement => (
  <div className="flex min-w-0 items-center gap-2">
    <span className="text-muted-foreground shrink-0 font-mono select-none">
      {prompt}
    </span>
    <code className="min-w-0 flex-1 overflow-x-auto font-mono text-nowrap">
      {command}
    </code>
    <CopyButton label={label} value={command} />
  </div>
);
