# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

## Verification before finishing

After making code changes, **do not consider the task done** until all of these exit successfully:

1. **`bun run check`** — `env:generate`, Ultracite (`ultracite check`), and knip. Run **`bun x ultracite fix`** first when issues are auto-fixable.
2. **`bun run check-types`** — TypeScript across the monorepo (`turbo run check-types`).
3. **`bun run precommit`** — matches what Husky runs after staged lint: `check`, affected `check-types` (`--filter='...[HEAD]'`), and `test`.

Fix every failure before stopping or committing. A green Ultracite run alone is not enough if types or pre-commit still fail.

## Git Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/). Every commit message:

```text
<type>(<optional scope>): <description>
```

- Use lowercase `type` and imperative description (what the commit does, not what you did)
- Keep the description under 72 characters; put detail in the body
- Do not end the subject with a period
- Use a body when the why is not obvious from the subject
- Breaking changes: `BREAKING CHANGE:` in the body, or `!` after the type/scope (`feat(api)!: ...`)

Types:

| Type       | Use for                                  |
| ---------- | ---------------------------------------- |
| `feat`     | New user-facing capability               |
| `fix`      | Bug fix                                  |
| `docs`     | Documentation only                       |
| `style`    | Formatting; no behavior change           |
| `refactor` | Behavior-preserving code change          |
| `perf`     | Performance improvement                  |
| `test`     | Tests only                               |
| `build`    | Build system or dependencies             |
| `ci`       | CI configuration                         |
| `chore`    | Maintenance that does not fit the others |

Examples: `feat(cli): add device login`, `fix(auth): reject special-use CIMD hosts`, `docs: describe terraform and wrangler split`.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Before adding or changing integration tests, read [docs/integration-tests.md](docs/integration-tests.md) and [tests/integration/README.md](tests/integration/README.md)
- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

## Design documents

`apps/web/Design.md` (marketing) and `apps/web/src/routes/d/DESIGN.md` (owner UI at `/d`) are visual language only: color, type, spacing, motion, surfaces, and general UX principles.

Never add product features, page sections, component inventories, implementation recipes, or copy decks to those files. Product behavior belongs in `vision.md` and `architecture.md`; UI structure belongs in code. When the look changes, update tokens and principles - not a catalog of widgets.

Do not restyle the owner UI from the marketing design file, or marketing from the `/d` design file.

## Monorepo placement

Put code in [`packages/`](packages) **only when it is shared** - imported from **more than one** app or package (e.g. web + MCP, or `packages/auth` + `apps/web`). If a module has a **single** consumer, keep it under that app (e.g. colocated under `apps/web/src/routes/…`) until a second consumer exists, then extract.

| Location | Use for |
| --- | --- |
| `apps/<app>/src/…` | Routes, server handlers, UI, and helpers used **only** by that app |
| `packages/*` | Schema, auth, UI kit, CLI, and other **cross-cutting** libraries with real multi-consumer use |

[`packages/api`](packages/api) is the shared **oRPC** surface: procedures and types that **more than one app** will call (web, MCP HTTP later). Do not add app-only procedures there. See [architecture.md](architecture.md) for the full rule.

Do not add to `packages/` “for organization” or “might be reused later” without a second consumer today - that spreads coupling and makes ownership unclear.

### Unused and barrel-only code

Remove dead code; do not grow public surfaces “just in case.”

- Run **`bun run knip`** (also part of **`bun run check`**) before finishing a change. Fix or delete what it reports: unused files, unused exports, unused dependencies.
- **Barrel files** (`index.ts` that re-export symbols) must not be the _only_ reason something exists. If a symbol is exported from a package entry or barrel but **never imported** outside that barrel chain, delete the symbol (and trim the barrel), not “leave it for the API.”
- Prefer **direct imports** to the defining module over re-exporting through barrels when only one app needs the code (see also **Avoid barrel files** under Performance above).
- Wrangler bundles the module you import, including its top-level imports. It cannot resolve TanStack Start's virtual modules (`#tanstack-router-entry`, `#tanstack-start-entry`, `tanstack-start-manifest:v`). `@functhis/auth` is the web session app and imports that plugin. Workers import a subpath (`@functhis/auth/publish-token`, `@functhis/auth/seed-cli-client`). When a package defines a subpath, a Wrangler worker imports that subpath so the bundle stays limited to that module.

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run **`bun x ultracite fix`**, then satisfy **Verification before finishing** above. Commit with a Conventional Commits subject as above.
