# Examples

Sample packages for manual smoke tests with [`packages/cli`](../packages/cli).

## Author contract

Each **callable** is one TypeScript file:

- **`export default`** — function declaration, arrow, or async handler (named exports are ignored).
- **Slug** — from the **file name** in kebab-case (`generatePresentation.ts` → `generate-presentation`). Public id: `@<handle>/<package-slug>/<function-slug>`.
- **`input` parameter** — single object argument; JSON Schema for MCP/HTTP is extracted from its TypeScript type (parameter must be named `input`).
- **JSDoc** — full description on the default export (tags stripped). `@example` tags are stored; `@param` / `@returns` add field descriptions when they match TypeScript property names (types win for shape).

Layout:

- **One or few handlers** at the package root (`hello.ts`), or
- **Many handlers** under `functions/**/*.ts` (when `functions/` exists, only files under it are bundled).

```ts
/**
 * Greet someone by name.
 */
export default function hello(input: { name?: string }) {
  return { message: `Hello, ${input.name ?? 'world'}!` };
}
```

Deploy records `contract` (`description`, optional `examples`, `inputSchema`, `outputSchema`) per function, bundles all sources into one Worker Loader module, and routes `{ functionSlug, input }` to the matching default export.

| Example                       | Purpose                               |
| ----------------------------- | ------------------------------------- |
| [hello-world](./hello-world/) | Single handler, deploy + execute path |

From repo root (recommended):

```bash
bun run example:hello:dev
bun run example:hello:deploy
```

Or with explicit `--project-root examples/hello-world` when invoking the CLI via `--filter`.
