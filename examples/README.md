# Examples

Sample packages for manual smoke tests with [`packages/cli`](../packages/cli).

## Author contract

Each **callable** is one TypeScript file:

- **`export default`** - function declaration, arrow, or async handler (named exports are ignored).
- **Slug** - from the path under the function root, kebab-case (`src/support/extendAccess.ts` → `support/extend-access`). Public id: `@<scope>/<package>/<namespace…>/<function>`.
- **`input` parameter** - single object argument; JSON Schema for MCP/HTTP is extracted from its TypeScript type (parameter must be named `input`).
- **JSDoc** - full description on the default export (tags stripped). `@example` tags are stored; `@param` / `@returns` add field descriptions when they match TypeScript property names (types win for shape).

Layout (nearest `package.json` is the package):

- **Dedicated tools package:** `src/**/*.ts` (directories become namespaces),
- **`functions/**/*.ts`** when `src/` is absent,
- **One or few handlers** at the package root (`hello.ts`),
- Or set `"functhis": { "root": "src/functions" }` in `package.json`.

```ts
/**
 * Greet someone by name.
 */
export default function hello(input: { name?: string }) {
  return { message: `Hello, ${input.name ?? 'world'}!` };
}
```

`functhis publish` records `contract` (`description`, optional `examples`, `inputSchema`, `outputSchema`) per function, bundles all sources into one Worker Loader module, uploads an artifact (bundle, source map, manifest, build metadata), and routes `{ functionSlug, input }` to the matching default export.

| Example | Purpose |
| --- | --- |
| [hello-world](./hello-world/) | Single handler, publish + execute path |
| [monorepo](./monorepo/) | Turborepo app + shared lib + functions package |

From repo root (recommended):

```bash
bun run example:hello:dev
bun run example:hello:deploy

bun run example:monorepo:dev
bun run example:monorepo:deploy   # --project-root packages/demo-functions inside monorepo
```

Or with explicit `--project-root` when invoking the CLI via `--filter`.

Full local workflow (stack, tests, login): [CONTRIBUTING.md](../CONTRIBUTING.md).
