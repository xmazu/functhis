import { IconCalendar } from '@tabler/icons-react';
import type { ReactElement } from 'react';

import { Button, buttonVariants } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { Popover, PopoverPopup, PopoverTrigger } from '#/components/ui/popover';
import { cn } from '#/lib/utils';
import { formatPackageDate } from '#/routes/d/-lib/package-dates';

export interface LogsDateRange {
  endTime?: string;
  startTime?: string;
}

const dateInputValue = (iso: string | undefined): string => {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfLocalDay = (value: string): string => {
  const date = new Date(`${value}T00:00:00`);
  return date.toISOString();
};

const endOfLocalDay = (value: string): string => {
  const date = new Date(`${value}T23:59:59.999`);
  return date.toISOString();
};

const rangeLabel = (range: LogsDateRange): string => {
  if (!(range.startTime || range.endTime)) {
    return 'Date';
  }
  if (range.startTime && range.endTime) {
    return `${formatPackageDate(range.startTime)} – ${formatPackageDate(range.endTime)}`;
  }
  if (range.startTime) {
    return `From ${formatPackageDate(range.startTime)}`;
  }
  return `To ${formatPackageDate(range.endTime ?? '')}`;
};

export const LogsDatePicker = ({
  onChange,
  value,
}: {
  onChange: (next: LogsDateRange) => void;
  value: LogsDateRange;
}): ReactElement => (
  <Popover>
    <PopoverTrigger
      className={cn(
        buttonVariants({ size: 'sm', variant: 'outline' }),
        'h-8 shrink-0 gap-1.5 font-normal shadow-none'
      )}
    >
      <IconCalendar className="size-3.5 opacity-50" />
      {rangeLabel(value)}
    </PopoverTrigger>
    <PopoverPopup className="w-64 p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="logs-date-from">From</Label>
          <Input
            id="logs-date-from"
            nativeInput
            onChange={(event) => {
              const next = event.currentTarget.value;
              onChange({
                ...value,
                startTime: next ? startOfLocalDay(next) : undefined,
              });
            }}
            type="date"
            value={dateInputValue(value.startTime)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="logs-date-to">To</Label>
          <Input
            id="logs-date-to"
            nativeInput
            onChange={(event) => {
              const next = event.currentTarget.value;
              onChange({
                ...value,
                endTime: next ? endOfLocalDay(next) : undefined,
              });
            }}
            type="date"
            value={dateInputValue(value.endTime)}
          />
        </div>
        {value.startTime || value.endTime ? (
          <Button
            onClick={() => {
              onChange({});
            }}
            size="sm"
            variant="ghost"
          >
            Clear
          </Button>
        ) : null}
      </div>
    </PopoverPopup>
  </Popover>
);
