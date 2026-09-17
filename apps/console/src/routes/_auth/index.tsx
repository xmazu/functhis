import { createFileRoute, Link } from '@tanstack/react-router';

const DashboardPage = () => {
  const { session } = Route.useRouteContext();

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 py-2.5">
        <h1 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
          Home
        </h1>
      </header>
      <div className="flex flex-col gap-2 p-4">
        <p className="text-[length:var(--app-font-size-ui,12px)]">
          Signed in as {session?.user.name} ({session?.user.email})
        </p>
        <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
          Manage deployed packages, copy public URLs and MCP snippets, and
          review recent executions from the Packages page.
        </p>
        <Link
          className="text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
          to="/packages"
        >
          Open packages
        </Link>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/_auth/')({
  component: DashboardPage,
});
