import { runtimeIsolateModuleSource } from './isolate-module.generated';
import type { FuncthisInvocationContext } from './isolate/runtime';

export type {
  FuncthisInvocationContext,
  RuntimeStore as FuncthisRuntimeStore,
} from './isolate/runtime';

export const RUNTIME_SPECIFIER = 'functhis:runtime';

export const RUNTIME_MODULE_ID = './__functhis_runtime.mjs';

export const RUNTIME_MODULE_VERSION = '2';

export const dynamicWorkerLoaderId = (versionId: string): string =>
  `${versionId}:${RUNTIME_MODULE_VERSION}`;

export const createRuntimeModuleSource = (): string =>
  runtimeIsolateModuleSource;

export type Context = () => FuncthisInvocationContext;

export type Secret = (name: string) => string;
