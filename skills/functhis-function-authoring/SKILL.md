---
name: functhis-function-authoring
description: Create, edit, test, publish, and evolve typed TypeScript functions for Functhis. Use when a user wants to build a Functhis function or package, make code callable by agents through Functhis, improve a function contract, run a function locally, publish a new version, or roll one back.
license: MIT
compatibility: Authoring requires a TypeScript project. Local execution and publishing require Node.js 20+; login and publishing require network access.
metadata:
  author: functhis
  version: '1.0.0'
---

# Functhis function authoring

Turn one focused piece of TypeScript behavior into a well-described, locally verified Functhis function. Preserve the user's project structure and authorization boundaries.

## Choose the stage

Determine the user's current lifecycle stage and do only the work needed for it:

1. **Shape** — clarify the capability, inputs, output, side effects, and failure behavior.
2. **Author** — create or edit one default-exported TypeScript function.
3. **Verify** — run the function locally with representative inputs and exercise meaningful edge cases.
4. **Publish** — authenticate and publish an immutable package version only when the user asks.
5. **Connect** — help an MCP client discover and execute the published function only when requested.
6. **Evolve** — change the source, verify again, and publish a new version; roll back to an existing version when requested.

Do not treat authoring as permission to publish, change visibility, connect an external client, or invoke a function with real-world side effects.

## Author the function

Before editing, inspect the nearest `package.json`, relevant source files, and `tsconfig.json`. Read [references/author-contract.md](references/author-contract.md) before creating or changing a callable.

- Prefer one narrow capability with a name based on the outcome, not the implementation.
- Use a single parameter named `input` with an explicit object type. Make fields required only when execution truly needs them.
- Return JSON-serializable data with a stable, explicit TypeScript type when practical.
- Put useful JSDoc on the default export. Describe what the function does and when an agent should use it. Document input fields and the return value when the names alone are insufficient.
- Validate constraints that TypeScript cannot express at runtime. Throw descriptive `Error` objects for invalid inputs or failed operations.
- Keep credentials out of source and input. If runtime context or secrets are actually needed, follow the optional runtime guidance in the author contract.
- Avoid scaffolding an HTTP server, route, Worker, or custom MCP server. Functhis supplies the execution and agent-facing layer.

Fit the smallest useful change into the existing project. Do not reorganize unrelated code or extract shared packages without a current second consumer.

## Verify locally

Run the repository's own checks for the files you changed. Then exercise the callable through Functhis from the package root:

```bash
npx functhis run --slug <function-slug> --input '<json>'
```

Use at least one realistic input. Add focused tests when the project has an established test setup or the function contains branching, transformation, validation, or side effects. Do not claim success from type-checking alone.

If the CLI cannot discover the function, check the function root, default export, file name, and nearest package boundary before changing configuration.

## Publish and operate

Read [references/lifecycle.md](references/lifecycle.md) when the user asks to publish, connect MCP, release a change, change visibility, or roll back.

Before publishing, summarize the discovered function slug and any externally visible input or output changes. Login is interactive; let the user complete authorization. Publishing creates a new immutable version, so never publish as an incidental verification step.

## Hand off

Report:

- the function's path and slug;
- its input and output contract in plain language;
- the local command and example input used;
- checks that passed or any remaining limitation;
- the next lifecycle command, without running it unless authorized.
