# Functhis - Product Vision

Updated: 2026-09-13

## Vision

Functhis turns TypeScript code into live, shareable tools.

A developer defines one or more functions, runs one deployment command, and receives working URLs that people, applications, and AI agents can invoke immediately. Functhis owns the repetitive infrastructure around the code: building, deployment, isolation, routing, input validation, access control, secrets, versions, execution limits, documentation, and agent-facing interfaces.

The shortest product promise is:

> **Write a function. Share a working tool.**

The more explicit version is:

> **Turn TypeScript functions into tools anyone-or any agent-can run.**

## Why Functhis should exist

Small pieces of useful logic are unusually expensive to distribute. A developer may need only fifty lines of code to generate a report, transform a file, query an external API, or render a presentation. Making that code safely usable by another person or an agent usually requires a server, deployment configuration, authentication, schemas, documentation, secrets, logs, and an integration protocol.

Source code in GitHub or npm is not yet a usable tool. Every consumer still has to install it, understand it, configure it, host it, and maintain it. A raw serverless platform solves compute, but it does not automatically turn a function into a discoverable, documented, testable, agent-ready product.

Functhis closes that gap. The author publishes executable behavior; the consumer receives a stable tool rather than an implementation project.

## Product thesis

AI agents will need far more narrow executable tools than teams will be willing to expose as separately built services or hand-written MCP servers. The winning abstraction is not another general hosting platform and not another directory of MCP servers. It is a thin publishing layer that converts ordinary typed functions into secure capabilities with several generated interfaces.

The source of truth is always the ordinary default-exported function and the contract extracted from its file path, TypeScript signature, and JSDoc. The compact MCP surface (`search` and `execute`) and optional HTTP endpoint are adapters over the same deployed capability. Generated OpenAPI, browser tooling, and SDKs may be added later, but they are not required for the first public alpha.

## The core product loop

The complete experience should feel almost immediate:

```text
write ordinary TypeScript function files
→ functhis deploy
→ receive live URLs
→ test in the browser
→ connect the project to an application or agent
→ inspect executions
→ deploy a new version or roll back
```

A project can contain several related functions. Functhis deploys the project as one isolated runtime unit while exposing each function as a separate logical tool.

```text
Project: presentation-tools

generate-presentation  → callable function
render-slide           → callable function
export-to-pdf          → callable function

Deployment boundary    → one project Worker
Discovery surface      → three logical functions behind search + execute
```

This model keeps deployments and costs manageable, allows related functions to share dependencies, and avoids combining an entire user account into one security boundary.

## Who it is for

The first user is a TypeScript developer building AI agents, SaaS products, automations, internal utilities, or reusable developer tooling. They are comfortable writing code but do not want to create a separate service and integration layer for every small capability.

The strongest early use cases are functions that create an obvious result and are easy to demonstrate: generating a PDF, rendering a presentation, transforming structured data, producing an image or archive, extracting information from a file, or wrapping a narrow API action.

OpenEnvX should be the first serious dogfood case. The initial alpha can validate slide models and generate Reveal-compatible HTML or SVG previews through JSON/text boundaries. Managed PDF/PPTX artifacts should follow after the deploy-and-run loop works end to end.

## What makes Functhis different

Functhis is not merely serverless function hosting. Cloudflare Workers, Vercel Functions, and similar products expose compute primitives. Functhis exposes a complete callable tool: contract, documentation, test interface, generated integration endpoints, execution policy, and sharing.

Functhis is not a source-code registry. The shared object is a running capability. Its recipient does not need the repository or runtime setup.

Functhis is not an MCP optimizer. MCP exposes one compact `search` and `execute` surface instead of one tool per function. The same published functions may also be called through HTTP.

Functhis is not an API documentation platform. It extracts enough contract metadata to validate, discover, and execute its own functions. Generated OpenAPI and importing selected third-party operations may become later capabilities, but they are not part of the initial product.

Functhis is not a workflow engine. It executes individual tools. Scheduling, branching, retries across multiple tools, and long-running orchestration belong to other products or a later layer.

## Product principles

### The first deployment must feel magical

The user should go from a TypeScript function to a working URL with one command and very little configuration. A deployment that requires Dockerfiles, infrastructure accounts, YAML, or manual routing defeats the purpose.

### A deployed function is useful without Functhis-specific knowledge

Every function needs a stable HTTP interface and understandable documentation. MCP and SDK integrations enhance distribution but cannot be the only way to use it.

### Projects are the execution and security boundary

Related functions share one deployment. Different projects receive separate runtimes, secrets, limits, and versions. A user account is an ownership boundary, not a runtime boundary.

### Safe defaults beat unlimited flexibility

The initial runtime supports only TypeScript and APIs compatible with Cloudflare Workers. Strict execution time, request size, response size, and usage limits are part of the product. Arbitrary binaries, containers, and unrestricted Linux execution are deliberately excluded.

### Contracts are first-class

Every function has a path-derived identifier, a JSDoc description, and input/output information extracted from its TypeScript signature. These contracts drive validation, lexical discovery, MCP execution, HTTP execution, and generated examples. The agent discovers a contract through `search`; Functhis does not expose every function as a separate MCP tool.

### A project should be portable

The CLI, discovery and schema extraction, bundling, contracts, local runner, and MCP/HTTP adapters should be open source. Developers should be able to test projects locally and understand the execution model without importing a function-definition SDK. The hosted Functhis service provides managed deployment, URLs, access controls, observability, and collaboration.

## Initial wedge

The first release should prove one narrow promise:

> A developer can publish a real TypeScript project and give an agent a working tool in less than five minutes.

The release is complete only when an unfamiliar developer can install the CLI, deploy without the founder's help, open the generated page, run a function, connect the project to an agent, and return later to publish a second version.

The initial demo should be visually convincing. An agent calls an OpenEnvX function through Functhis and receives a rendered presentation or PDF. This demonstrates code execution, file results, generated schemas, and agent integration in one flow.

## Open-source and hosted model

The open-source layer should include the CLI, function discovery, TypeScript contract extraction, local development server, bundling logic, MCP/HTTP adapters, and reusable protocol types. This makes the project credible, easy to adopt, and valuable even before the hosted service is mature.

The hosted product at `functhis.now` should own managed execution, stable URLs, private access, secrets, version history, execution history, limits, and later project pages and team collaboration. The commercial value comes from safely operating and sharing tools, not from hiding the function format.

## Business model

The free plan should make the first successful deployment easy while containing abuse through small package, execution, CPU, and retention limits. Paid individual plans can increase private packages, executions, history, and limits. Managed storage for execution outputs (PDFs, archives, and similar files) belongs to a later version. Team plans can later add shared ownership, access policies, audit retention, service identities, and consolidated billing.

Pricing should be tied primarily to packages, executions, compute, retention, and collaboration-not to the number of logical function definitions alone. A package may contain many cheap functions, while one heavily used function can create most of the infrastructure cost.

Functhis must enforce hard quotas before billing sophistication. A free public endpoint can be attacked or scraped, so request, CPU, concurrency, response-size, and artifact limits must fail closed rather than generate an uncontrolled bill.

## Expansion after product validation

Only after developers repeatedly deploy and use the core product should Functhis expand. Plausible additions include generated OpenAPI, importing selected OpenAPI operations as remote tools, managed file artifacts, Infisical-backed secret synchronization, credential brokering that prevents third-party code from seeing user tokens, team workspaces, private runners inside customer networks, scheduled invocations, Python or container runtimes, an installable tool catalog, custom domains, and richer observability.

These are separate bets. None should delay validation of the basic publish-and-run loop.

## Explicit non-goals for the MVP

The v0.1 public alpha does not include a dashboard, browser playground, billing, a knowledge graph, repository analysis, automatic composition of multiple MCP servers, token optimization, semantic tool discovery, embeddings, generated OpenAPI, OpenAPI import, arbitrary OpenAPI documentation hosting, a marketplace, workflows, scheduled jobs, managed binary artifacts, private network runners, customer-provided containers, Python, Go, browser automation, or a general Linux sandbox.

Infisical is also outside the MVP. Initially, a project's author owns both its code and its secrets. Supporting a public function that safely uses each caller's private credentials requires a credential broker and outbound policy layer; simple secret injection is not sufficient.

## Validation

The first launch should be judged by behavior rather than attention alone. GitHub stars are useful distribution, but the product is validated only when unrelated developers deploy functions without help and return to update or create another project.

Good first-month evidence would be at least twenty completed deployments, five unrelated users deploying without direct assistance, three users returning for a second deployment, three requests for private or team functionality, and one team willing to test a paid plan. If people star the repository but do not deploy, the open-source story may be attractive while the hosted product remains unproven.

## Long-term vision

Functhis can become the simplest publishing and distribution layer for executable software capabilities. A developer writes domain logic once; Functhis makes it available to humans, applications, and agents without forcing the author to build a new microservice or integration server each time.

The long-term opportunity is a network of dependable, typed, permissioned tools. The route to that vision begins with a much smaller product:

> **One TypeScript project in. Working, shareable tools out.**
