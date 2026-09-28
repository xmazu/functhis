import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { Textarea } from '#/components/ui/textarea';
import { messageFromUnknown } from '#/lib/errors/dashboard';
import { zodOnSubmit } from '#/lib/form/zod-on-submit';
import { cn } from '#/lib/utils';
import { packageConsoleContentClassName } from '#/routes/d/-components/package-console-content';
import {
  acceptSourceGenerationForSession,
  importOpenApiForSession,
  importRemoteMcpForSession,
} from '#/routes/d/-server/catalog-sources';

const ui = 'text-[length:var(--app-font-size-ui,12px)]';

const openApiSchema = z.object({
  credentialName: z.string(),
  slug: z.string().trim().min(1),
  spec: z.string().trim().min(2),
});

const mcpSchema = z.object({
  credentialName: z.string(),
  endpoint: z.string().trim().url(),
  slug: z.string().trim().min(1),
});

const CatalogSourcesPage = (): ReactElement => {
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const openApiForm = useForm({
    defaultValues: { credentialName: '', slug: '', spec: '' },
    validators: { onSubmit: zodOnSubmit(openApiSchema) },
    onSubmit: async ({ value }) => {
      try {
        const spec = JSON.parse(value.spec) as unknown;
        const result = await importOpenApiForSession({
          data: {
            credentialName: value.credentialName || undefined,
            slug: value.slug,
            spec,
          },
        });
        setPendingSourceId(result.drifted ? result.sourceId : null);
        setMessage(
          result.drifted
            ? `Imported with schema drift. Generation ${String(result.generation)} stays executable.`
            : `Imported OpenAPI source ${value.slug}.`
        );
      } catch (error) {
        setMessage(messageFromUnknown(error));
      }
    },
  });
  const mcpForm = useForm({
    defaultValues: { credentialName: '', endpoint: '', slug: '' },
    validators: { onSubmit: zodOnSubmit(mcpSchema) },
    onSubmit: async ({ value }) => {
      try {
        const result = await importRemoteMcpForSession({
          data: {
            credentialName: value.credentialName || undefined,
            endpoint: value.endpoint,
            slug: value.slug,
          },
        });
        setMessage(`Remote MCP source ${value.slug} is ${result.health}.`);
      } catch (error) {
        setMessage(messageFromUnknown(error));
      }
    },
  });

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className={cn(packageConsoleContentClassName, 'pt-6')}>
        <h1 className={`${ui} font-medium`}>Catalog sources</h1>
        <p className={`${ui} text-muted-foreground mt-2`}>
          Import OpenAPI operations or connect a remote MCP server as owned
          capability ids.
        </p>
        {message ? <output className={`${ui} mt-3`}>{message}</output> : null}
        {pendingSourceId ? (
          <Button
            className="mt-3"
            onClick={() => {
              void (async () => {
                try {
                  await acceptSourceGenerationForSession({
                    data: { sourceId: pendingSourceId },
                  });
                  setPendingSourceId(null);
                  setMessage('Accepted the drifted generation.');
                } catch (error) {
                  setMessage(messageFromUnknown(error));
                }
              })();
            }}
            type="button"
          >
            Accept generation
          </Button>
        ) : null}
        <section className="mt-6 flex flex-col gap-3">
          <h2 className={`${ui} font-medium`}>OpenAPI</h2>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void openApiForm.handleSubmit();
            }}
          >
            <openApiForm.Field name="slug">
              {(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={field.name}>Package slug</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </openApiForm.Field>
            <openApiForm.Field name="credentialName">
              {(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={field.name}>Secret name</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </openApiForm.Field>
            <openApiForm.Field name="spec">
              {(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={field.name}>OpenAPI JSON</Label>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    rows={8}
                    value={field.state.value}
                  />
                </div>
              )}
            </openApiForm.Field>
            <Button type="submit">Import OpenAPI</Button>
          </form>
        </section>
        <section className="mt-8 flex flex-col gap-3">
          <h2 className={`${ui} font-medium`}>Remote MCP</h2>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void mcpForm.handleSubmit();
            }}
          >
            <mcpForm.Field name="slug">
              {(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={field.name}>Connection slug</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </mcpForm.Field>
            <mcpForm.Field name="endpoint">
              {(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={field.name}>Endpoint</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </mcpForm.Field>
            <mcpForm.Field name="credentialName">
              {(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={field.name}>Secret name</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </mcpForm.Field>
            <Button type="submit">Connect MCP</Button>
          </form>
        </section>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/d/sources')({
  component: CatalogSourcesPage,
});
