import { Skeleton } from '@functhis/ui/components/skeleton';

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <Skeleton className="h-8 w-48" />
    </div>
  );
}
