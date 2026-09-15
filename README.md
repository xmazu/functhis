# functhis

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Self, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Drizzle** - TypeScript-first ORM
- **Cloudflare D1** - Database engine
- **Authentication** - Better-Auth
- **Husky** - Git hooks for code quality
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses Cloudflare D1 (SQLite) with Drizzle ORM.

Runtime database access uses the Cloudflare `DB` binding declared in Wrangler and provisioned by Terraform in `packages/infra`. If a local `DATABASE_URL` is present, it is only for database tooling.

Terraform creates the D1 database. Wrangler applies migrations (`bun run db:migrate` / `wrangler d1 migrations apply`).

1. Generate migration files:

```bash
bun run db:generate
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the fullstack application.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from '@functhis/ui/components/button';
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `bun run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

For Cloudflare, Varlock validates local and CI inputs. Worker code reads native bindings from Wrangler; web clients use the framework's public env API through `src/env.public.ts` where needed. Terraform outputs resource ids into Wrangler config. Platform secrets live in Cloudflare Secrets Store, not in Terraform state.

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. Node deployments must include Varlock and its dependencies alongside the app schema.

## Deployment

Infrastructure is Terraform. First-party Worker code is Wrangler. See [architecture.md](architecture.md).

- Target: `functhis-web` + `functhis-runtime` on Cloudflare
- Auth: `CLOUDFLARE_API_TOKEN` (never a global API key)
- Dev: `bun run dev` (both Workers in one Miniflare)
- Infra: `cd packages/infra/terraform/environments/production && terraform apply`
- Code: `wrangler deploy` per Worker after Terraform outputs are wired
- Migrations: `wrangler d1 migrations apply`

Do not create customer packages, Artifacts repos, or dispatch namespaces in Terraform. Package deploys go through the deploy API: Artifacts commit, KV bundle, D1 version row.

## Git Hooks and Formatting

- Initialize hooks: `bun run prepare`
- Run checks: `bun run check`

## Project Structure

```
functhis/
├── apps/
│   └── web/         # Fullstack application (React + TanStack Start)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run check-types`: Check TypeScript types across all apps
- `bun run dev:types`: Watch API and dependency declarations when running an app individually. The root `dev` command already starts this watcher; installation and builds generate declarations automatically.
- `bun run db:generate`: Generate database client/types
- `bun run check`: Run Oxlint and Oxfmt
