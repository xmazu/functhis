# Functhis Product Roadmap

Updated: 2026-09-25

## Product direction

Functhis turns ordinary TypeScript functions into secure, versioned capabilities that people, applications, and AI agents can discover, authorize, run, automate, and trust.

```text
TypeScript function + JSDoc + package metadata
→ contract → version → capability
→ MCP, HTTP, browser, SDK, routine, webhook, and workflow surfaces
```

Functhis combines Val Town's immediacy, Speakeasy's contract discipline, Arcade and Composio's caller-owned authorization, Kody's durable packages and triggers, and Inngest/Trigger.dev's reliable execution semantics.

> A function is the capability atom, a package is the deployment and security boundary, a connection supplies caller authority, a trigger starts work, a workflow finishes work durably, and a run records what happened.

## Status legend

- `[x]` implemented in the current repository.
- `[~]` partially implemented; the foundation exists but is incomplete.
- `[ ]` planned.

Status describes repository implementation, not production readiness.

## Current foundation

Extend this foundation rather than rebuilding it.

### Authoring and contracts

- [x] Discover default-exported TypeScript and TSX functions.
- [x] Resolve package and configurable function roots.
- [x] Derive stable function slugs, including nested namespaces, from paths.
- [x] Extract descriptions and examples from JSDoc.
- [x] Generate JSON-compatible input and output schemas from TypeScript types.
- [x] Build searchable contract text from identity, description, and schemas.
- [x] Validate hosted invocation input against the stored input schema.
- [~] Support the JSON Schema subset needed by real TypeScript contracts.
- [ ] Validate successful outputs against the declared output contract.
- [ ] Classify side effects and required capabilities in contract metadata.

### CLI and publishing

- [x] Provide `functhis login` with OAuth device authorization.
- [x] Provide local `functhis run` and the initial `functhis dev` alias.
- [x] Publish packages in organization scopes (workspace org required; user scope removed).
- [x] Support private, organization, and public-library visibility.
- [x] Build Cloudflare-compatible ESM bundles locally.
- [x] Externalize and inject `functhis:runtime` into hosted bundles.
- [x] Upload canonical artifacts to R2 and hot bundles to KV.
- [x] Create immutable semver versions with source and bundle hashes.
- [x] Record optional Git SHA and dirty state as provenance.
- [x] Roll back to an existing semver without rebuilding.
- [~] Enforce publish-time manifest, bundle, and artifact size limits.
- [ ] Add `functhis check` as the complete local pre-publish gate.
- [ ] Add `functhis versions` and machine-readable CLI output.
- [ ] Turn `functhis dev` into a persistent watcher and local playground.

### Identity and access

- [x] Use GitHub as the initial identity provider.
- [x] Act as an OAuth 2.1 authorization server for MCP clients.
- [x] Separate MCP and CLI resource audiences.
- [x] Support user handles (identity) and organization slugs (public package scope).
- [x] Provide organization creation, membership, invitations, and acceptance.
- [x] Require a workspace organization before publish (`/d/onboard` onboarding).
- [x] Enforce package visibility in catalog reads and execution.
- [~] Provide owner package and organization management under `/d`.
- [ ] Add workspace roles and package-level permissions.
- [ ] Add revocable API keys, service identities, and scoped application tokens.

### Discovery and execution

- [x] Expose one MCP resource with compact `search` and `execute` tools.
- [x] Use `@org/package/function` as the capability identity (org slug is the public scope).
- [x] Search `mine`, `org`, and `library` through HOT KV indexes.
- [x] Rank lexical matches and prioritize exact capability IDs.
- [x] Optionally rerank ambiguous shortlists with a small model and safe fallback.
- [x] Execute immutable versions through Cloudflare Dynamic Workers.
- [x] Reuse isolates by package version and runtime kernel version.
- [x] Keep origin bindings and secrets out of Dynamic Workers by default.
- [x] Pass invocation context through `functhis:runtime` AsyncLocalStorage.
- [x] Apply request, response, CPU, and subrequest limits.
- [~] Return structured validation failures through MCP.
- [ ] Define one stable execution envelope for every transport.
- [ ] Safely reject non-serializable and oversized results.
- [ ] Capture package logs without mutating isolate-wide console state.

### Data and infrastructure

- [x] Store packages, functions, immutable versions, and runs in Postgres.
- [x] Use Neon through Hyperdrive for hosted metadata.
- [x] Use R2 as the canonical published-artifact store.
- [x] Use KV for hot bundles, search documents, memberships, and JWKS.
- [x] Emit execution metrics to Workers Analytics Engine.
- [x] Manage account infrastructure with Terraform and Worker code with Wrangler.
- [x] Separate the web control plane from the MCP execution plane.
- [~] Record execution rows with caller, version, sizes, status, and CPU.
- [ ] Complete repeatable preview and production deploys with smoke checks.
- [ ] Add authoritative quota counters and fail-closed concurrency controls.

## Phase 1 — Production-ready publish and run

Complete the current promise before broadening the product.

### Contract correctness

- [ ] Expand schema support for unions, literals, enums, tuples, nested arrays, nullable values, records, and referenced types.
- [ ] Preserve JSDoc descriptions for nested properties.
- [ ] Parse and validate structured examples.
- [ ] Report unsupported public types with file and line diagnostics.
- [ ] Validate outputs in local, preview, and hosted execution.
- [ ] Define stable errors for invalid input/output, timeout, quota, missing function/version, bundle failure, and runtime failure.
- [ ] Add fixtures proving local and hosted parity.

### Local developer experience

- [ ] Implement `functhis check` for discovery, contracts, bundle compatibility, permissions, secrets, artifact size, and dependencies.
- [ ] Make `functhis dev` a persistent server with file watching.
- [ ] Add a local function selector, schema form, JSON editor, and result view.
- [ ] Show the generated contract and hosted identity before publishing.
- [ ] Emulate runtime context, secrets, artifacts, and storage locally.
- [ ] Add `--json` output for CI and coding agents.

### Stable execution

- [ ] Define a versioned request and response protocol package.
- [ ] Return execution ID, status, result, artifacts, timings, and error.
- [ ] Generate an execution ID before any fallible work.
- [ ] Capture structured stdout, stderr, and runtime logs per invocation.
- [ ] Enforce serialization and content-size limits before returning.
- [ ] Add idempotency keys for effectful invocations.
- [ ] Add per-user, organization, package, and function rate limits.
- [ ] Add per-package concurrency limits and fair queuing.
- [ ] Add emergency package and account disable controls.

### Owner UI and onboarding

- [ ] Finish package overview, functions, recent runs, and sharing states.
- [ ] Add version history with provenance, active state, and rollback.
- [ ] Add execution list and execution detail pages.
- [ ] Add copy-ready MCP configuration for common clients.
- [ ] Replace placeholder docs with a five-minute quick start.
- [ ] Add examples for a pure function, API wrapper, and artifact result.
- [ ] Verify onboarding through rollback with a clean external account.

### Exit criteria

- [ ] 20 successful external deployments.
- [ ] Five unrelated developers publish without founder assistance.
- [ ] Three developers publish a second version.
- [ ] Three users execute through a real MCP client.
- [ ] Limits, rollback, and emergency disable are verified in production.

## Phase 2 — Generated capability surfaces

One contract generates every supported way to use a function.

### Hosted playground

- [ ] Add authenticated public-facing function pages after alpha.
- [ ] Generate forms from schemas with a raw JSON escape hatch.
- [ ] Render JSON, text, Markdown, images, audio, video, and file results.
- [ ] Support version, dry-run, connection, and run-now controls.
- [ ] Show validation errors before execution.
- [ ] Generate curl, TypeScript, Python, and MCP examples.
- [ ] Save a successful invocation as a test case.

### HTTP capability API

- [ ] Add a dedicated HTTP execution surface without routing untrusted code through `functhis-web`.
- [ ] Expose contract retrieval and synchronous invocation.
- [ ] Support bearer tokens, service identities, pinned versions, idempotency, streaming, and asynchronous invocation.
- [ ] Keep HTTP and MCP authorization, quota, execution, and result semantics identical.
- [ ] Add anonymous execution only after abuse controls are proven.

### Generated interfaces

- [ ] Generate package-level OpenAPI with stable operation IDs.
- [ ] Publish lightweight TypeScript and Python clients.
- [ ] Generate per-function CLI examples and optional CLI wrappers.
- [ ] Export a selected Function Set as a standalone MCP server.
- [ ] Version generated artifacts with their source package version.

### Contract diffs and releases

- [ ] Diff functions and schemas between versions.
- [ ] Classify breaking, additive, behavioral, and metadata-only changes.
- [ ] Suggest semver and reject accidental breaking changes.
- [ ] Generate release notes from contract diffs.
- [ ] Add preview versions and manual promotion to current.
- [ ] Notify dependent sets, tokens, routines, and workflows of breakage.

## Phase 3 — Secrets, connections, and authorization

Separate author-owned credentials from caller-owned accounts.

### Hosted package secrets

- [ ] Store values in a dedicated secret store and metadata in Postgres.
- [ ] Add CLI set, list, delete, and rotate operations.
- [ ] Wire hosted references into `functhis:runtime`.
- [ ] Never expose a plaintext `secretGet` API.
- [ ] Scope secrets to user, organization, or package ownership.
- [ ] Require package approval and outbound-host approval.
- [ ] Support expiry, rotation without deploy, audit, and revocation.
- [ ] Add best-effort redaction and output leak detection.
- [ ] Document the remaining exfiltration risk of approved untrusted code.

### Connection broker

- [ ] Model providers, auth configs, connections, scopes, and account identities.
- [ ] Let functions declare required providers and minimum scopes.
- [ ] Return `authorization_required` with a secure Connect Link.
- [ ] Store and refresh OAuth tokens outside package isolates.
- [ ] Inject authorization at the outbound network boundary.
- [ ] Support multiple accounts per provider and explicit selection.
- [ ] Support user-, organization-, and service-owned connections.
- [ ] Support managed OAuth apps and bring-your-own OAuth credentials.
- [ ] Audit authorization, refresh, use, failure, and revocation.

### Providers and agent gateways

- [ ] Ship GitHub as the first complete provider and dogfood it.
- [ ] Add Google, Slack, Linear, and Stripe from real package demand.
- [ ] Prefer narrow provider capabilities over exposing entire raw APIs.
- [ ] Version provider operations and expose provider events.
- [ ] Create named Function Sets with selected functions and pinned versions.
- [ ] Give sets scoped tokens and optional dedicated MCP endpoints.
- [ ] Bind connections, budgets, environments, and policies to sets.
- [ ] Support read, write, destructive, and approval-required classes.

## Phase 4 — Package state and artifacts

### Package storage

- [ ] Add portable `storage` APIs for get, set, delete, list, and compare-and-set.
- [ ] Provide package, user-package, organization-package, and routine scopes.
- [ ] Enforce quotas, value limits, retention, and ownership.
- [ ] Audit access without logging values.
- [ ] Provide local emulation and test isolation.

### Execution artifacts

- [ ] Make artifacts a first-class runtime result rather than encoded JSON.
- [ ] Store outputs in R2 with ownership and retention metadata.
- [ ] Support files, images, audio, video, PDFs, archives, and streams.
- [ ] Generate signed URLs and safe browser previews.
- [ ] Enforce per-file, per-run, and monthly limits.
- [ ] Track lineage from producing run to consuming run.
- [ ] Pass artifacts to later functions without a public download.
- [ ] Add deletion, expiry, and organization retention policies.

## Phase 5 — Routines, webhooks, and events

A routine starts one published capability outside an active conversation. It is not a general workflow graph.

### Routine model and scheduling

- [ ] Model owner, target version, arguments, connections, trigger, execution policy, notifications, and enabled state.
- [ ] Add create, update, enable, disable, run-now, duplicate, and delete.
- [ ] Require a successful manual or dry run before initial enablement by default.
- [ ] Show next run, prior runs, current status, and failure streak.
- [ ] Pin a version or explicitly opt into following current.
- [ ] Run one platform scheduler instead of one Cloudflare cron per user.
- [ ] Support cron, friendly input, timezone, DST, start, and expiry.
- [ ] Define missed-run, overlap, catch-up, and clock-skew policies.
- [ ] Claim due runs transactionally and enqueue idempotent messages.
- [ ] Deduplicate on routine ID and scheduled timestamp.
- [ ] Apply tenant concurrency, priority, retry, and dead-letter rules.

### Inbound webhooks

- [ ] Mint opaque credentialed URLs that never appear in agent output.
- [ ] Bind one webhook definition to one package handler.
- [ ] Support rotation, disable, reveal audit, and staged overlap.
- [ ] Enforce body, content-type, and rate limits with fast ACK.
- [ ] Add HMAC, timestamp windows, delivery-ID deduplication, and provider verification adapters.
- [ ] Store delivery metadata without bodies by default.
- [ ] Add delivery history, retry visibility, and owner redelivery.

### Events and subscriptions

- [ ] Add a typed event envelope with source, topic, schema, time, trace, and idempotency key.
- [ ] Let packages declare subscriptions in package metadata.
- [ ] Validate schemas at publish and dispatch time.
- [ ] Support synthetic dispatch for testing.
- [ ] Add retry, dead letter, replay, fan-out, and recursion guards.
- [ ] Emit platform events for runs, artifacts, routines, connections, usage, and package lifecycle changes.
- [ ] Route provider events through the same model.

### Notifications

- [ ] Support failure-only, meaningful-result, and always policies.
- [ ] Keep unchanged monitoring routines quiet by default.
- [ ] Start with in-product notifications and email.
- [ ] Add Slack and webhook destinations later.
- [ ] Group repeated failures and suppress duplicate noise.

## Phase 6 — Durable workflows

Use Cloudflare Dynamic Workflows if validation confirms it can keep user-authored workflow code inside the existing Dynamic Worker security and billing model.

### Workflow runtime

- [ ] Add durable `step.run`, `sleep`, `sleepUntil`, `waitForEvent`, and invoke.
- [ ] Persist step results and skip completed steps on replay.
- [ ] Support per-step timeout, retry, backoff, and sensitive results.
- [ ] Support sequential, parallel, and bounded fan-out execution.
- [ ] Support cancel, pause, resume, terminate, and expiry.
- [ ] Add compensation handlers for explicitly reversible steps.
- [ ] Preserve trace and authorization context across suspensions.
- [ ] Pin instances to package and runtime versions.

### Flow control and human decisions

- [ ] Add concurrency keys per user, organization, connection, and external API.
- [ ] Add rate limits, throttling, batching, debounce, priority, and fairness.
- [ ] Exclude sleeping and event-waiting runs from active concurrency.
- [ ] Add idempotent child invocation and event dispatch.
- [ ] Add dead-letter handling and replay from a selected step.
- [ ] Add approval steps with approvers and expiry.
- [ ] Show proposed action, input, connection, and effects before approval.
- [ ] Support approve, reject, edit-and-approve, and delegate.
- [ ] Resume the exact instance and audit every decision.

### Workflow observability

- [ ] Render a timeline of steps, attempts, sleeps, events, and child runs.
- [ ] Show persisted data subject to redaction and retention policy.
- [ ] Add progress reporting and real-time status subscriptions.
- [ ] Support replay with original or edited input.
- [ ] Attribute usage across compute, steps, state, and artifacts.

## Phase 7 — Testing, promotion, and trust

### Reusable tests

- [ ] Save executions as package-owned test cases.
- [ ] Support exact, partial, schema, snapshot, predicate, artifact, and duration assertions.
- [ ] Add connection mocks and explicit test connections.
- [ ] Run tests locally, in preview, and against a selected hosted version.
- [ ] Isolate tests from production package storage by default.

### Promotion pipeline

- [ ] Run contracts, tests, dependency checks, and policies before activation.
- [ ] Add preview, canary, production, and stable channels.
- [ ] Support manual and policy-driven promotion.
- [ ] Compare output, errors, latency, and resource use between versions.
- [ ] Shadow only functions proven free of side effects.
- [ ] Roll back automatically on configured error or latency thresholds.

### Supply-chain trust

- [ ] Record complete source-to-bundle build attestations.
- [ ] Sign published artifacts and verify before execution.
- [ ] Lock dependency resolution and scan vulnerabilities.
- [ ] Detect suspicious dynamic code, network access, and secret use.
- [ ] Display runtime, dependencies, permissions, and egress in package details.

## Phase 8 — Catalog, reuse, and API import

### Public library

- [ ] Add library browse and package details.
- [ ] Rank by relevance, successful runs, stability, freshness, documentation, and publisher trust rather than raw installs.
- [ ] Show examples, versions, changelog, permissions, egress, connections, limits, and playground access.
- [ ] Add verified publishers, reporting, moderation, and a kill switch.
- [ ] Add curated collections and starter packages.

### Fork and remix

- [ ] Export or fork source into the user's own Git repository.
- [ ] Preserve upstream identity and provenance.
- [ ] Show upstream changes as reviewable diffs.
- [ ] Never inherit secrets or connections automatically.
- [ ] Require explicit review and adoption before credentials can be granted.
- [ ] Do not build an in-platform Git host or general browser IDE.

### OpenAPI import

- [ ] Import a spec and let the author select operations.
- [ ] Generate a normal reviewable Functhis package, not an opaque proxy.
- [ ] Add overlays for names, descriptions, schemas, scopes, and hidden methods.
- [ ] Generate auth, pagination, retries, structured errors, and examples.
- [ ] Track upstream revisions and propose update diffs.
- [ ] Keep exports narrower than the provider's complete API.

## Phase 9 — Observability, usage, and business

### Observability and audit

- [ ] Store trigger, caller, acting user, package, function, version, connection, timings, sizes, attempts, parent run, and error category.
- [ ] Add searchable logs and per-run trace timelines.
- [ ] Correlate MCP, HTTP, routine, webhook, event, and workflow activity.
- [ ] Avoid retaining input and output bodies by default.
- [ ] Add configurable retention, redaction, and export.
- [ ] Keep audit events separate from execution logs.

### Usage and quotas

- [ ] Count runs, CPU, requests, transfer, artifacts, storage, workflow steps, and unique Dynamic Worker days where applicable.
- [ ] Keep billing truth outside Analytics Engine and log vendors.
- [~] Enforce limits at organization and package levels (Free/Pro caps on publish and execute).
- [ ] Reject work before compute when a hard limit is exhausted.
- [ ] Show usage, forecasts, and 80/100 percent warnings.
- [ ] Add budgets and circuit breakers for public endpoints.

### Plans and billing

- [x] Define Free and Pro entitlements outside Stripe (`packages/publish/src/org-entitlements.ts`).
- [x] Start with hard included limits instead of automatic overages.
- [x] Add Stripe Checkout, Customer Portal, and idempotent webhooks (Better Auth Stripe plugin, org customers).
- [ ] Define Team and Enterprise entitlements.
- [ ] Add grace periods and explicit failed-payment behavior.
- [ ] Add metered overages only after counters are proven.
- [~] Support organization billing (Free/Pro live; temporary overrides later).

### Operations

- [ ] Monitor errors, latency, queues, scheduler lag, workflow backlog, storage, abuse, and provider failures.
- [ ] Define incident response, status communication, backup, and restore.
- [ ] Test Cloudflare and Neon failure modes.
- [ ] Add package quarantine and selective execution-plane shutdown.
- [ ] Define service objectives before selling SLAs.

## Phase 10 — Teams and enterprise

### Collaboration and policy

- [ ] Add owner, admin, developer, operator, and viewer roles.
- [ ] Add grants for packages, environments, secrets, connections, routines, and workflows.
- [ ] Add service accounts and expiring scoped tokens.
- [ ] Add approvals for publish, promotion, destructive functions, and sensitive connections.
- [ ] Add organization-wide usage, audit, policy, and billing views.
- [ ] Restrict visibility, dependencies, runtimes, egress, regions, retention, public webhooks, and anonymous execution.
- [ ] Require pinned versions, signed artifacts, tests, or manual promotion.
- [ ] Apply policy changes without redeploying package code.

### Enterprise foundation

- [ ] Add SAML/SSO and SCIM from paying-customer demand.
- [ ] Add configurable audit retention and SIEM export.
- [ ] Add customer-managed keys where required.
- [ ] Add private runners or customer-network connectivity.
- [ ] Add regional execution and data residency from validated demand.
- [ ] Add enterprise support, incident commitments, and SLAs.

## Cross-cutting architecture rules

- Keep ordinary TypeScript functions as the basic authoring primitive.
- Keep versions immutable; long-lived objects must pin a version or explicitly follow current.
- Keep untrusted code in Dynamic Workers and never inherit control-plane bindings.
- Keep the web control plane separate from untrusted execution.
- Add dedicated Workers for automation, ingress, or coordination; do not attach Durable Objects to `functhis-web`.
- Use queues for at-least-once delivery and idempotency at effectful boundaries.
- Use managed durable execution instead of a home-grown workflow engine.
- Keep credentials out of model context, logs, stored arguments, and results.
- Generate every interface from the same contract and authorization policy.
- Put modules in `packages/` only after a second real consumer exists.
- Measure successful repeated use, not marketplace or integration breadth.

## Explicit non-goals

- No in-platform Git hosting or general browser IDE.
- No visual no-code workflow builder before code-defined workflows are proven.
- No one-MCP-tool-per-function public surface.
- No transparent proxy of arbitrary third-party MCP servers.
- No indiscriminate generation of every provider endpoint as an agent tool.
- No Python, Go, containers, or general Linux sandbox until TypeScript has strong repeated usage.
- No custom domains before first-party execution surfaces are stable.
- No automatic metered overages before usage accounting is authoritative.
- No credentials inherited by forks, public packages, routines, or workflows.
- No second execution platform unless Cloudflare fails a measured requirement.

## Recommended delivery order

1. Finish publish, execute, errors, logs, limits, deploys, and onboarding.
2. Add playground, HTTP execution, contract diffs, and generated OpenAPI.
3. Ship hosted secrets, service identities, and Function Sets.
4. Build the connection broker and prove it with GitHub.
5. Add package storage and first-class execution artifacts.
6. Add routines, schedules, webhooks, events, and notifications.
7. Add durable workflows, flow control, and human approvals.
8. Add tests, promotion channels, attestations, and safe releases.
9. Open the library, fork/remix, and OpenAPI import.
10. Add billing, team controls, and enterprise policy from validated demand.

## Success measures

- Time from install to first successful hosted run.
- Percentage of publishers reaching a second version.
- Weekly active packages and successful runs per active package.
- Percentage of functions used by more than one caller or client.
- Repeat use through MCP, HTTP, routines, and workflows.
- Authorization completion and connection reuse rates.
- Routine and workflow completion rates.
- Rollback, retry, and recovery effectiveness.
- Public adoption resulting in successful runs rather than page views.
- Infrastructure cost and support load per successful run.
