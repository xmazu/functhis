import { createFileRoute } from '@tanstack/react-router';

const DashboardPage = () => {
  const { session } = Route.useRouteContext();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <section className="rounded-lg border p-6">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-muted-foreground mt-2">
          Signed in as {session?.user.name} ({session?.user.email})
        </p>
      </section>
      <section className="rounded-lg border p-6">
        <h2 className="font-medium">Console</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Package management, MCP snippets, and execution history arrive in a
          later phase. This console already hosts GitHub login, OAuth consent,
          and CLI device approval.
        </p>
      </section>
    </main>
  );
};

export const Route = createFileRoute('/_auth/')({
  component: DashboardPage,
});
