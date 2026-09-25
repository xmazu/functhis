# Functhis author contract

## Package and discovery boundary

The nearest `package.json` defines the package. Functhis selects one function root in this order:

1. `functhis.root` from `package.json`;
2. `src/` when it exists;
3. `functions/` when `src/` does not exist;
4. otherwise, TypeScript files directly in the package root.

A configured root, `src/`, or `functions/` is scanned recursively. Root fallback is shallow. Test, spec, declaration, dependency, Git, `dist`, and `.functhis` files are ignored.

In a workspace, work from the intended package rather than the workspace root. Keep a single-consumer function in that app or package; do not move it into a shared package speculatively.

## Callable shape

Each callable is one `.ts` or `.tsx` file with one default-exported function declaration, function expression, or arrow function. Named exports are not published as callables.

```ts
interface FormatTitleInput {
  title: string;
  uppercase?: boolean;
}

interface FormatTitleOutput {
  title: string;
}

/**
 * Normalize a title for display in product interfaces.
 *
 * @param input.title Raw title to normalize.
 * @param input.uppercase Convert the normalized title to uppercase.
 * @returns The normalized display title.
 */
export default function formatTitle(
  input: FormatTitleInput
): FormatTitleOutput {
  const title = input.title.trim();
  if (!title) {
    throw new Error('title must not be empty');
  }
  return { title: input.uppercase ? title.toUpperCase() : title };
}
```

The optional input parameter must be named `input` for its TypeScript type to become the input schema. Prefer a typed object even for one value so the contract can evolve without replacing a positional API.

Use JSON-compatible types: strings, numbers, booleans, nullability, arrays, nested objects, and literal unions. Avoid relying on classes, symbols, functions, `bigint`, cyclic data, or complex conditional and generic types in the public contract.

## Identity

The function slug comes from its path relative to the function root. Segments are converted to kebab-case, and an `index.ts` uses its parent path:

```text
src/summarizeText.ts       -> summarize-text
src/content/summarize.ts   -> content/summarize
src/content/index.ts       -> content
```

After publishing, the public MCP id is:

```text
@<user-or-org>/<package>/<function-slug>
```

Moving or renaming the file changes the function identity. Treat that as a public API change after the first publish.

## Generated contract

Functhis derives the contract from TypeScript and JSDoc:

- the export's JSDoc description becomes search and usage guidance;
- `@example` values are retained as examples;
- `@param input.field` comments describe matching input properties;
- `@returns` describes the output;
- TypeScript types determine the JSON schema shape.

Write descriptions for consumers who cannot see the implementation. Include the capability, important constraints, and distinctions from similarly named functions. Do not stuff implementation details or promotional copy into JSDoc.

## Runtime behavior

Functions may be synchronous or asynchronous. Return JSON-serializable results. Keep behavior deterministic when the capability allows it, bound untrusted input, set timeouts for outbound work, and surface actionable errors without leaking credentials.

No Functhis SDK is required for ordinary functions. For invocation metadata or local secrets, install `functhis` as a development dependency, include `/// <reference types="functhis" />` in a declaration file covered by `tsconfig.json`, and import only what is needed:

```ts
import { context, secret } from 'functhis:runtime';
```

`context()` exposes invocation identity. `secret(name)` reads secrets supplied to local runs with `--secret NAME=value`. Hosted secret wiring is not available yet, so do not design a hosted function that depends on it without confirming current platform support.
