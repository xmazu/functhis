import { createFileRoute } from '@tanstack/react-router';

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
          Package management, MCP snippets, and execution history arrive in a
          later phase. This console already hosts GitHub login, OAuth consent,
          and CLI device approval.
        </p>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/_auth/')({
  component: DashboardPage,
});
