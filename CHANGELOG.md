# Changelog

All notable changes to this project are documented here.
The published npm CLI (`functhis`) is versioned with each GitHub Release.

## [0.1.2] - 2026-09-26

### Other

- Add Functhis function authoring skill and enhance documentation; update agent prompts and lifecycle references for improved user guidance

- Enhance organization workspace onboarding and billing features; update architecture and roadmap documentation to reflect new organizational structure and billing capabilities; integrate Stripe for payment processing and improve user experience in organization management

- Update workspace onboarding flow to use new `/d/onboard` route; modify architecture and roadmap documentation accordingly; enhance ultracite script for linting and formatting; update package dependencies for improved compatibility

- Implement new database migration for user and organization management; add subscription and billing tables with necessary fields; remove legacy billing migration files to streamline database structure

- Introduce functhis SDK with client and Next.js handler; enhance CLI package to support new SDK features, update documentation for usage, and improve build scripts for SDK components

- Implement isMemberOfOrganization function for membership validation; refactor org-billing route to utilize new membership check, and add corresponding tests for functionality

## [0.1.1] - 2026-09-25

### Other

- Update dependencies in bun.lock, enhance PUBLISHING.md with detailed release steps, and improve README.md for maintainers; remove obsolete deploy-web workflow

- Add support for Cloudflare Workers types in publish package; update TypeScript configuration and dependencies, enhance worker module handling, and improve tests for dynamic worker execution

- Add TypeScript author types for 'functhis:runtime', enhance CLI package with typings, and update documentation for TypeScript integration; improve build scripts and tests for type declarations

- Update configuration files to ignore generated CHANGELOG.md in oxfmt and oxlint setups, ensuring cleaner output and preventing unnecessary changes in version control

- Update repository links in documentation and components to reflect new ownership under xmazu

- V0.1.1

## [0.1.0] - 2026-09-25

### Documentation

- Add architecture and roadmap documentation, update Git commit guidelines in AGENTS.md, and clarify deployment process in README.md


### Other

- Init

- Introduce console application with authentication and routing, update database configuration to use Neon Postgres, and enhance local development setup with Docker support

- Update dependencies in package.json, add knip configuration for linting, and refactor pre-commit hook to integrate ultracite and knip checks

- Enhance Terraform infrastructure setup with custom domains, secrets management, and Hyperdrive configurations; update architecture and README documentation for clarity on deployment processes

- Restructure API and deployment documentation, enhance shared code guidelines in AGENTS.md, and introduce runtime worker for dynamic execution with KV support

- Add MCP application with dynamic execution capabilities, update architecture and README for deployment clarity, and enhance local development setup with new Wrangler configurations

- Enhance console application with new design system, update component structure, and integrate Tabler icons; add design documentation and refactor styles for improved UI consistency

- Add package management features to console application, including routes for listing and viewing packages, enhance deployment capabilities with new server functions, and update environment configurations for improved functionality

- Enhance CLI functionality with input parsing, package slug validation, and improved deployment output formatting; add comprehensive tests for new features and refactor configuration handling for better URL resolution

- Implement organization management features in console application, including routes for viewing and inviting members, enhance package sharing capabilities, and update authentication flow for improved user experience

- Initialize functhis CLI with version 0.1.0, add changelog and publishing documentation, and integrate git-cliff for automated changelog generation

- Update pre-commit hook to run ultracite checks and modify package.json to integrate knip for linting

- Update knip configuration and entry points in package.json and drizzle.config.ts, add env generation step in CI workflow

- Implement login redirection logic in console application, refactor routes to utilize new redirectToLogin function, and update precommit hook in package.json

- Add integration testing setup with PostgreSQL service in CI, update package.json for integration test commands, and enhance AGENTS.md with testing documentation

- Enhance MCP functionality with AI integration for search capabilities, implement input validation for function execution, and update architecture documentation; add new search ranking logic and database schema modifications for improved performance

- Introduce visual language documentation for web design, update deployment scripts in package.json, and enhance console application with new components and styling; add design tokens and layout guidelines for improved UI consistency

- Update precommit hook to include tests, simplify Cloudflare environment type declarations, and refine design documentation for consistency in language and formatting

- Implement publish API routes for start and finalize, create publish handler context, and add authentication token parsing; enhance CLI with publish functionality and validation tests

- Enhance architecture documentation with runtime kernel versioning details, update bun.lock to include @functhis/runtime, and add new components for package sharing and command execution in the console application

- Consolidate console application into web application, removing console-specific files and updating documentation for owner UI; enhance design documentation and adjust environment configurations for improved clarity

- Implement authentication and authorization components for web application; add session management, device verification, and catalog access handling; enhance routing and UI elements for improved user experience

- Update routing structure and component imports for owner UI; migrate modules to routes directory, enhance design documentation references, and remove obsolete files for improved organization

- Restructure UI components and update imports for web application; remove obsolete UI package references, enhance design documentation, and introduce new UI elements for improved consistency and organization

- Enhance MCP search functionality with AI-driven reranking; integrate OpenRouter for improved search relevance, update architecture documentation, and refine KV storage handling for function metadata

- Streamline MCP functionality by removing internal execution handling, updating environment configurations, and enhancing documentation; improve access control and error handling in function execution

- Update architecture documentation to reflect changes in fetch behavior for Workers; add favicon link in root route; support HEAD requests in auth API; adjust tests for redirect handling in fetchClientMetadataResource

- Introduce consent management features in web application; implement consent redirect handling, OAuth query processing, and countdown functionality; enhance MCP protocol support and add comprehensive tests for new functionalities


### Refactor

- Refactor code style to use single quotes for string literals across multiple files, update configuration files, and add product vision documentation.

- Refactor session resolution logic to support SSR and client-side handling; add callbackURLFromLocation utility for improved login redirection in routes

<!-- generated by git-cliff -->
