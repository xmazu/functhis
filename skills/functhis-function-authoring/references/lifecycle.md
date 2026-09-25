# Functhis lifecycle

## 1. Shape

Start with one capability that can be named as an action and tested with concrete JSON. Identify:

- required and optional input;
- JSON-compatible output;
- validation and error cases;
- network, credential, or other side-effect requirements.

For a first function, prefer a local transformation over a destructive or credential-dependent action.

## 2. Author and verify

Create the default-exported function according to `author-contract.md`. From the package root, run it with its path-derived slug:

```bash
npx functhis run --slug <function-slug> --input '<json>'
```

`run` and `dev` are local aliases. Pass local-only secrets as repeated `--secret NAME=value` flags when necessary, and avoid placing secret values in shell history when the environment provides a safer mechanism.

## 3. Publish

Publishing requires explicit user intent and an interactive login:

```bash
npx functhis login
npx functhis publish
```

Run these from the intended package. Useful explicit options include:

```bash
npx functhis publish --slug <package-slug> --project-root <path>
```

Packages default to private. Change visibility only when the user explicitly chooses `private`, `organization`, or `library`:

```bash
npx functhis publish --visibility <visibility>
```

The CLI discovers all callables in the selected function root, builds them together, creates an immutable semantic version, and prints each MCP id. Record those ids in the handoff.

## 4. Connect and execute

Connect an MCP-compatible client once to:

```text
https://mcp.functhis.now/mcp
```

OAuth controls access. The shared MCP surface has two tools:

- `search` discovers accessible functions;
- `execute` calls a selected `@scope/package/function` id with JSON arguments.

Do not build one MCP server or one MCP tool per function.

## 5. Evolve

Source remains in the author's project. To change behavior or the contract:

1. edit the source;
2. rerun representative local inputs and project checks;
3. call out breaking input, output, slug, visibility, side-effect, or permission changes;
4. publish again to create a new immutable version.

The current package version changes, while prior versions remain available for rollback. Do not overwrite or mutate published artifacts.

## 6. Roll back

When the user selects an existing version:

```bash
npx functhis rollback <semver>
```

Rollback points the package at that immutable version; it does not rebuild source. Confirm the package and target version before running it, then verify the active behavior.
