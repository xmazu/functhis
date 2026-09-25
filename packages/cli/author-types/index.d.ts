/**
 * Ambient types for `import from 'functhis:runtime'`.
 * Keep in sync with `@functhis/runtime` isolate public API.
 */
declare module 'functhis:runtime' {
  export interface FuncthisInvocationContext {
    callerUserId: string | null;
    executionId: string;
    functionSlug: string;
    packageVersionId: string;
  }
  export function context(): FuncthisInvocationContext;
  export function secret(name: string): string;
}
