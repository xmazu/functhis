import { Link, createFileRoute } from '@tanstack/react-router';

import { getPackageDetailForSession } from '@/server/packages';

const PackageDetailPage = () => {
  const detail = Route.useLoaderData();

  if (!detail) {
    return (
      <main className="flex min-h-0 flex-1 flex-col p-4">
        <p className="text-[length:var(--app-font-size-ui,12px)]">
          Package not found.
        </p>
        <Link
          className="mt-2 text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
          to="/packages"
        >
          Back to packages
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 py-2.5">
        <h1 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
          Package {detail.packageSlug}
        </h1>
      </header>
      <div className="flex flex-col gap-4 p-4">
        <section className="flex flex-col gap-1">
          <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Public URL
          </h2>
          <a
            className="font-mono text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
            href={detail.packageUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {detail.packageUrl}
          </a>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Functions
          </h2>
          {detail.functions.map((fn) => (
            <div className="border p-3" key={fn.slug}>
              <p className="text-[length:var(--app-font-size-ui,12px)] font-medium">
                {fn.slug}
              </p>
              <a
                className="font-mono text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
                href={fn.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {fn.url}
              </a>
              <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed">
                {fn.mcpSnippet}
              </pre>
            </div>
          ))}
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Recent executions
          </h2>
          {detail.executions.length === 0 ? (
            <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
              No executions recorded yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {detail.executions.map((row) => (
                <li
                  className="text-[length:var(--app-font-size-ui,12px)]"
                  key={row.id}
                >
                  {row.createdAt.toISOString()} · {row.functionSlug ?? '—'} ·{' '}
                  {row.status}
                  {row.cpuMs === null ? '' : ` · ${row.cpuMs}ms`}
                </li>
              ))}
            </ul>
          )}
        </section>
        <Link
          className="text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
          to="/packages"
        >
          Back to packages
        </Link>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/_auth/packages/$slug')({
  component: PackageDetailPage,
  loader: ({ params }) =>
    getPackageDetailForSession({ data: { slug: params.slug } }),
});
