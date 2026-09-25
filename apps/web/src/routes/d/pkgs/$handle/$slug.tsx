import { Link, createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { authClient } from '#/lib/auth/auth-client';
import { CommandRow } from '#/routes/d/-components/command-row';
import { CopyButton } from '#/routes/d/-components/copy-button';
import {
  MetaItem,
  SectionHeading,
  packageDetailUiClass,
} from '#/routes/d/-components/package-detail-primitives';
import { PackageSharingPanel } from '#/routes/d/-components/package-sharing-panel';
import {
  formatPackageDate,
  formatPackageDateTime,
  toPackageIso,
} from '#/routes/d/-lib/package-dates';
import { getPackageDetailForSession } from '#/routes/d/-server/packages';

const ui = packageDetailUiClass;

const VISIBILITY_LABEL = {
  library: 'Library',
  organization: 'Organization',
  private: 'Private',
} as const;

const PackageDetailPage = (): ReactElement => {
  const { handle, slug } = Route.useParams();
  const detail = Route.useLoaderData();
  const { data: organizations } = authClient.useListOrganizations();

  if (!detail) {
    return (
      <main className="flex min-h-0 flex-1 flex-col p-4">
        <p className={ui}>Package not found.</p>
        <Link
          className={`${ui} mt-2 underline-offset-2 hover:underline`}
          to="/d/pkgs"
        >
          Back to packages
        </Link>
      </main>
    );
  }

  const packageName = `@${detail.handle}/${detail.packageSlug}`;
  const description =
    detail.functions.find((fn) => fn.description !== null)?.description ?? null;
  const [firstFunction] = detail.functions;

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-b px-4 pt-4 pb-2">
        <div className="flex min-w-0 items-center gap-1">
          <h1
            className={`${ui} min-w-0 font-mono font-medium break-all`}
            title={packageName}
          >
            {packageName}
          </h1>
          <CopyButton label="Copy package name" value={packageName} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className={`${ui} font-mono`}>{detail.semver}</p>
          {detail.isOwner ? null : (
            <p className={`${ui} text-muted-foreground`}>Shared with you</p>
          )}
        </div>
      </header>
      <article className="flex flex-col px-4 pt-4 pb-6">
        <section>
          {description ? (
            <p className={`${ui} text-muted-foreground max-w-2xl text-pretty`}>
              {description}
            </p>
          ) : null}
          <ul
            className={`${ui} mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5`}
          >
            <li>
              <span
                className={`${ui} text-muted-foreground border-border inline-flex rounded-md border px-2 py-0.5 font-mono`}
              >
                {VISIBILITY_LABEL[detail.visibility]}
              </span>
            </li>
            <li>
              <a
                className="font-mono underline-offset-2 hover:underline"
                href={detail.packageUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Public URL
              </a>
            </li>
          </ul>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-y py-4 sm:grid-cols-3 sm:gap-4">
            <MetaItem label="Functions">{detail.functions.length}</MetaItem>
            <MetaItem label="Version">{detail.semver}</MetaItem>
            <MetaItem label="Published">
              <time dateTime={toPackageIso(detail.publishedAt)}>
                {formatPackageDate(detail.publishedAt)}
              </time>
            </MetaItem>
          </dl>
        </section>
        <section className="mt-5 scroll-mt-10" id="get-started">
          <div className="mb-2">
            <SectionHeading>Get started</SectionHeading>
          </div>
          <div
            className={`${ui} border-border overflow-hidden rounded-lg border`}
          >
            <div className="space-y-1 overflow-x-auto px-3 py-3">
              <CommandRow
                command={`curl '${detail.packageUrl}'`}
                label="Copy inspect command"
              />
              {firstFunction ? (
                <>
                  <p className="text-muted-foreground pt-1 font-mono select-none">
                    # Call
                  </p>
                  <CommandRow
                    command={firstFunction.httpSnippet}
                    label="Copy call command"
                  />
                </>
              ) : null}
            </div>
          </div>
        </section>
        <div className="mt-6 flex flex-col-reverse gap-8 lg:flex-row">
          <section className="min-w-0 flex-1 scroll-mt-10" id="functions">
            <SectionHeading>Functions</SectionHeading>
            {detail.functions.length === 0 ? (
              <p className={`${ui} text-muted-foreground mt-2`}>
                No functions.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col">
                {detail.functions.map((fn) => (
                  <li
                    className="border-border scroll-mt-10 border-b py-3 last:border-b-0"
                    id={`fn-${fn.slug}`}
                    key={fn.slug}
                  >
                    <div className="flex min-w-0 items-center gap-1">
                      <h3 className={`${ui} min-w-0 font-mono font-medium`}>
                        {fn.slug}
                      </h3>
                      <CopyButton label={`Copy ${fn.slug} id`} value={fn.id} />
                    </div>
                    {fn.description ? (
                      <p
                        className={`${ui} text-muted-foreground mt-1 text-pretty`}
                      >
                        {fn.description}
                      </p>
                    ) : null}
                    <div className={`${ui} mt-2`}>
                      <CommandRow
                        command={fn.httpSnippet}
                        label={`Copy ${fn.slug} call command`}
                      />
                    </div>
                    <div className="mt-1 flex items-start gap-2">
                      <pre
                        className={`${ui} text-muted-foreground min-w-0 flex-1 overflow-x-auto font-mono`}
                      >
                        {fn.mcpSnippet}
                      </pre>
                      <CopyButton
                        label={`Copy ${fn.slug} MCP snippet`}
                        value={fn.mcpSnippet}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-56">
            <section className="scroll-mt-10" id="current-version">
              <SectionHeading>Current version</SectionHeading>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className={`${ui} font-mono`}>{detail.semver}</span>
                <time
                  className={`${ui} text-muted-foreground`}
                  dateTime={toPackageIso(detail.publishedAt)}
                >
                  {formatPackageDate(detail.publishedAt)}
                </time>
              </div>
            </section>
            <section>
              <SectionHeading>
                Functions ({detail.functions.length})
              </SectionHeading>
              {detail.functions.length === 0 ? (
                <p className={`${ui} text-muted-foreground mt-1`}>None</p>
              ) : (
                <ul className="mt-1 flex flex-col">
                  {detail.functions.map((fn) => (
                    <li
                      className="flex h-[var(--app-density-row-height,1.75rem)] items-center"
                      key={fn.slug}
                    >
                      <a
                        className={`${ui} truncate font-mono underline-offset-2 hover:underline`}
                        href={`#fn-${fn.slug}`}
                      >
                        {fn.slug}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {detail.isOwner &&
            (detail.visibility === 'private' ||
              detail.visibility === 'organization') ? (
              <PackageSharingPanel
                handle={handle}
                initialOrganizationSlug={detail.organizationSlug ?? ''}
                initialVisibility={detail.visibility}
                key={`${handle}/${slug}`}
                organizationSlugs={(organizations ?? []).map((org) => org.slug)}
                packageSlug={slug}
              />
            ) : null}
            {detail.isOwner ? (
              <section>
                <SectionHeading>Recent executions</SectionHeading>
                {detail.executions.length === 0 ? (
                  <p className={`${ui} text-muted-foreground mt-1`}>
                    No executions recorded yet.
                  </p>
                ) : (
                  <ul className="mt-1 flex flex-col">
                    {detail.executions.map((row) => (
                      <li
                        className={`${ui} text-muted-foreground border-border border-b py-1.5 last:border-b-0`}
                        key={row.id}
                      >
                        <time dateTime={toPackageIso(row.createdAt)}>
                          {formatPackageDateTime(row.createdAt)}
                        </time>
                        <span className="text-foreground ms-1 font-mono">
                          {row.functionSlug ?? '—'}
                        </span>
                        <span className="ms-1">{row.status}</span>
                        {row.cpuMs === null ? null : (
                          <span className="ms-1 font-mono tabular-nums">
                            {row.cpuMs}&nbsp;ms
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
          </aside>
        </div>
      </article>
    </main>
  );
};

export const Route = createFileRoute('/d/pkgs/$handle/$slug')({
  component: PackageDetailPage,
  loader: ({ params }) =>
    getPackageDetailForSession({
      data: { handle: params.handle, slug: params.slug },
    }),
});
