````markdown
# Functhis - MVP and V1 Roadmap

This roadmap starts from the current repository state. It separates the public alpha MVP from the first paid product version.

## Product Goal

Functhis turns ordinary TypeScript functions into hosted, versioned tools that can be invoked through HTTP or through a compact MCP interface using `search` and `execute`.

The MVP must prove one complete loop:

```text
write a TypeScript function
→ test it locally
→ deploy it
→ configure a secret
→ execute it through HTTP and MCP
→ inspect logs and usage
→ deploy a new version
→ roll back
```
````

## MVP - Public Alpha

### 1. Core Function Model

- [x] Discover default-exported TypeScript functions.
- [x] Derive function slugs from file paths.
- [x] Extract descriptions from JSDoc.
- [x] Generate a JSON-compatible input schema from TypeScript types.
- [ ] Validate invocation input against the generated contract.
- [ ] Return stable, structured validation and runtime errors.
- [ ] Handle non-serializable return values safely.
- [ ] Capture function logs without mutating the isolate-wide global console.

### 2. Local Developer Experience

- [x] Provide `functhis run` for a single local invocation.
- [x] Provide `functhis dev` as the initial local execution command.
- [ ] Turn `functhis dev` into a persistent development server with file watching.
- [ ] Add a local function playground for selecting a function and editing JSON input.
- [ ] Make local execution behavior match hosted execution behavior.
- [ ] Add `functhis check` for discovery, contract, bundle, compatibility, and size validation.

### 3. Authentication and Access

- [x] Support GitHub login.
- [x] Support OAuth 2.1 for MCP clients.
- [x] Support device authorization for CLI login.
- [x] Support private, organization, and public library visibility.
- [x] Enforce package access rules for HTTP and MCP execution.
- [ ] Add revocable API keys for applications and CI.
- [ ] Require authentication for execution during the private alpha.
- [ ] Add strict anonymous rate limits before enabling public execution.

### 4. Deployment and Runtime

- [x] Build functions into a Cloudflare-compatible bundle.
- [x] Store immutable package versions.
- [x] Store bundles by content hash.
- [x] Execute package versions through Cloudflare Dynamic Workers.
- [x] Apply per-invocation CPU, subrequest, request-size, and response-size limits.
- [ ] Validate an end-to-end deployment on a clean production-like preview environment.
- [ ] Replace placeholder Cloudflare resource identifiers with a repeatable deployment process.
- [ ] Add automated preview deployment and production smoke checks.
- [ ] Prevent unbounded public execution costs with package and account limits.

### 5. HTTP and MCP Interfaces

- [x] Provide stable package and function URLs.
- [x] Support HTTP `GET` for function contracts.
- [x] Support HTTP `POST` for execution.
- [x] Expose one MCP server with `search` and `execute`.
- [x] Search functions by handle, package, function slug, and description.
- [ ] Return consistent execution envelopes across local, HTTP, and MCP transports.
- [ ] Provide copy-ready HTTP and MCP examples on every function page.
- [ ] Add one-click MCP configuration snippets for common clients.

### 6. Versions and Rollback

- [x] Create an immutable version for every deployment.
- [x] Track the currently active package version.
- [ ] Add `functhis versions`.
- [ ] Add `functhis rollback <version>`.
- [ ] Show version history in the console.
- [ ] Show deploy time, author, source hash, and active status.
- [ ] Allow rollback from the console without rebuilding the bundle.

### 7. Package Secrets

- [ ] Store package secret values in Infisical.
- [ ] Store only secret names and metadata in the Functhis database.
- [ ] Add `functhis secrets set <name>`.
- [ ] Add `functhis secrets list` without exposing values.
- [ ] Add `functhis secrets delete <name>`.
- [ ] Expose secrets to functions through `functhis:runtime`.
- [ ] Keep Infisical credentials outside Dynamic Workers.
- [ ] Add short-lived in-memory caching and best-effort secret redaction.
- [ ] Document that malicious function code can intentionally disclose secrets it is allowed to read.

### 8. Execution History, Logs, and Analytics

- [x] Record basic execution rows in Postgres.
- [x] Emit basic execution metrics to Cloudflare Analytics Engine.
- [ ] Generate a unique `executionId` for every invocation.
- [ ] Send runtime logs and final execution events to Axiom.
- [ ] Correlate logs with package, function, version, caller, and transport.
- [ ] Show execution status, duration, request size, response size, and error category.
- [ ] Add searchable execution history and a per-execution detail page.
- [ ] Avoid storing request and response bodies by default.
- [ ] Add explicit retention limits for execution rows and logs.

### 9. Usage Metering and Hard Limits

- [ ] Define usage dimensions: executions, wall time, CPU where available, transfer, and concurrency.
- [ ] Stop treating wall-clock duration as CPU usage.
- [ ] Add authoritative usage counters outside Axiom.
- [ ] Enforce monthly account and organization execution limits.
- [ ] Enforce per-package concurrency and rate limits.
- [ ] Reject over-limit invocations before starting a Dynamic Worker.
- [ ] Show current usage and limits in the console.
- [ ] Add warnings at 80% and 100% of the allowance.
- [ ] Keep Analytics Engine and Axiom for analytics, not billing truth.

### 10. Console and Documentation

- [x] List accessible packages.
- [x] Show package functions, URLs, MCP snippets, sharing, and recent executions.
- [x] Provide basic organization management.
- [ ] Add package overview, versions, secrets, executions, logs, and usage sections.
- [ ] Replace the raw function page with a usable contract viewer and playground.
- [ ] Replace the Better-T-Stack boilerplate landing page.
- [ ] Replace the placeholder Fumadocs content with real documentation.
- [ ] Write a five-minute quick start.
- [ ] Add one complete API-wrapper example using a secret.
- [ ] Add an OpenEnvX dogfood example executed through MCP.

### 11. Release Readiness

- [ ] Run the complete onboarding flow with a new GitHub account.
- [ ] Verify CLI installation from the published npm package.
- [ ] Verify HTTP and MCP execution in preview and production.
- [ ] Verify a second deployment and rollback.
- [ ] Verify secret rotation without redeploying code.
- [ ] Verify limits fail closed.
- [ ] Add basic abuse handling and an emergency package-disable switch.
- [ ] Publish the free public alpha with conservative limits.

### MVP Success Criteria

- [ ] At least 20 successful external deployments.
- [ ] At least 5 unrelated developers deploy without direct help.
- [ ] At least 3 developers return for a second deployment.
- [ ] At least 3 users connect Functhis to a real MCP client or agent.
- [ ] At least 1 team asks for higher limits or paid collaboration features.

## V1 - Paid Product

### 1. Plans and Entitlements

- [ ] Add Free, Pro, and Team plans.
- [ ] Model plan entitlements separately from billing provider data.
- [ ] Configure limits for packages, executions, concurrency, compute, and log retention.
- [ ] Support temporary overrides for early customers.
- [ ] Apply entitlement changes without redeploying packages.

### 2. Billing

- [ ] Add Stripe Checkout for paid subscriptions.
- [ ] Add Stripe Customer Portal for invoices, payment methods, and cancellation.
- [ ] Process Stripe webhooks idempotently.
- [ ] Persist subscription status and billing customer identifiers.
- [ ] Add grace-period behavior for failed payments.
- [ ] Start with hard plan limits instead of usage overage billing.
- [ ] Add metered overages only after usage accounting has been proven reliable.

### 3. Team Workspaces

- [x] Provide basic organizations and membership.
- [ ] Add workspace roles: owner, admin, developer, and viewer.
- [ ] Add service accounts and scoped tokens.
- [ ] Add package-level permissions.
- [ ] Add organization-wide usage and consolidated billing.
- [ ] Add invitation emails and membership lifecycle management.
- [ ] Add audit events for deploys, rollbacks, secret changes, and access changes.

### 4. Function Sets

- [ ] Allow users to create named sets of selected functions.
- [ ] Give every set a dedicated MCP endpoint or scoped token.
- [ ] Restrict `search` and `execute` to functions included in the set.
- [ ] Use sets to provide different capabilities to different agents.
- [ ] Track usage and permissions per set.

### 5. Testing and Safe Releases

- [ ] Save an existing execution as a reusable test case.
- [ ] Run test cases against a selected package version.
- [ ] Compare outputs, errors, duration, and contract compatibility between versions.
- [ ] Add pre-activation validation for a newly deployed version.
- [ ] Allow manual promotion of a tested version to current.
- [ ] Add deployment diffs for contracts and function lists.

### 6. Production Observability

- [ ] Add dashboards for error rate, latency, execution volume, and top functions.
- [ ] Add user-configurable alerts for errors and usage thresholds.
- [ ] Provide longer log retention on paid plans.
- [ ] Add export of execution metadata and audit events.
- [ ] Add platform-level alerts for failing packages and infrastructure incidents.

### 7. Enterprise Foundation

- [ ] Add SSO/SAML and automated user provisioning when demanded by customers.
- [ ] Add configurable retention and audit-log export.
- [ ] Add organization policies for visibility, egress, secrets, and allowed dependencies.
- [ ] Add outbound network allowlists or a controlled egress broker.
- [ ] Add regional execution and data residency only when required by paying customers.
- [ ] Define support, incident-response, and SLA processes.
- [ ] Evaluate private runners or customer-network connectivity for enterprise use cases.

### 8. Distribution and Integrations

- [ ] Add generated OpenAPI for deployed functions.
- [ ] Add SDK generation only for proven integration demand.
- [ ] Add an optional Monid example or publishing integration without making it a core dependency.
- [ ] Add managed large outputs through R2 for PDFs, archives, and generated files.
- [ ] Add local or hybrid tunnels if customers need access to private systems.

## Explicitly Deferred

- [ ] Source-code marketplace or importing another user's package.
- [ ] Git hosting or an in-platform code workspace.
- [ ] General MCP aggregation and proxying of unrelated MCP servers.
- [ ] Workflow orchestration, branching, and scheduled jobs.
- [ ] Python, Go, containers, or a general Linux sandbox.
- [ ] Semantic search and embeddings before lexical search proves insufficient.
- [ ] Custom domains before stable hosted URLs are validated.
- [ ] Metered overage billing before usage counters are trustworthy.

## Recommended Delivery Order

1. Production-like preview and end-to-end smoke test.
2. Runtime validation, safe errors, and concurrency-safe logs.
3. Authentication, rate limits, concurrency limits, and abuse controls.
4. Version history and rollback.
5. Infisical-backed package secrets.
6. Axiom execution logs and execution detail pages.
7. Authoritative usage counters and hard plan limits.
8. Console, function playground, documentation, and onboarding.
9. Free public alpha and product validation.
10. Plans, Stripe billing, and paid V1.
11. Function Sets, reusable tests, and team permissions.
12. Enterprise controls based on real customer demand.

```

```
