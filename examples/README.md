# Examples

Sample packages for manual smoke tests with [`packages/cli`](../packages/cli). Each example is a small tree of `.ts` files with **default exports** (discovered and bundled by the CLI).

| Example                       | Purpose                               |
| ----------------------------- | ------------------------------------- |
| [hello-world](./hello-world/) | Single handler, deploy + execute path |

From repo root (recommended):

```bash
bun run example:hello:dev
bun run example:hello:deploy
```

Or with explicit `--project-root examples/hello-world` when invoking the CLI via `--filter`.

More examples can be added alongside `hello-world` as features grow.
