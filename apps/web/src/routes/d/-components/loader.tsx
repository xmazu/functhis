import { Skeleton } from '#/components/ui/skeleton';

const Loader = () => (
  <div className="flex h-full items-center justify-center p-8">
    <Skeleton className="h-8 w-48" />
  </div>
);

export default Loader;
