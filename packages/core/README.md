# @functhis/core

Publish pipeline, MCP (`search` / `execute`), runtime isolation, and **catalog ports** for Functhis. No database in this package — implement `CatalogPorts` via `@functhis/core/publish` (see `ports.ts` in that entry).

## Install

```bash
npm install @functhis/core
```

Package ships **TypeScript source**. Use a bundler or runtime that resolves `exports` to `.ts` (Bun, or your build tool).

## Entrypoints

| Import                   | Use                                            |
| ------------------------ | ---------------------------------------------- |
| `@functhis/core/mcp`     | MCP worker, `search`, `execute` dispatch       |
| `@functhis/core/publish` | Publish, ports, HTTP handlers, secrets, search |
| `@functhis/core/runtime` | Isolate runtime module                         |

## Peers

You supply Cloudflare-style bindings (`HOT`, `BUNDLES`, `LOADER`, …) and a `CatalogPorts` implementation when wiring workers or a custom server.

## Publish to npm

```bash
cd packages/core
npm login   # once, scoped @functhis org
npm publish
```

`prepack` runs `bun run build` (regenerates isolate bundle). DevDeps and `imports` are not shipped.

## License

MIT
