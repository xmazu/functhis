import { formatFunctionId } from '@functhis/publish';
import type { CatalogPackageRow, ExecutionSummaryRow } from '@functhis/publish';

const readContractDescription = (contract: unknown): string | null => {
  if (typeof contract !== 'object' || contract === null) {
    return null;
  }
  if (!('description' in contract)) {
    return null;
  }
  const { description } = contract;
  if (typeof description !== 'string') {
    return null;
  }
  const trimmed = description.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export interface PackageDetailFunctionView {
  description: string | null;
  id: string;
  mcpSnippet: string;
  slug: string;
}

export interface PackageDetailViewModel {
  executions: ExecutionSummaryRow[];
  functions: PackageDetailFunctionView[];
  handle: string;
  isOwner: boolean;
  organizationId: string;
  organizationSlug: string | null;
  packageSlug: string;
  publishedAt: Date;
  semver: string;
  visibility: CatalogPackageRow['visibility'];
}

export const buildPackageDetailViewModel = (input: {
  catalog: CatalogPackageRow;
  executions: PackageDetailViewModel['executions'];
  isOwner: boolean;
  mcpResource: string;
  organizationSlug: string | null;
}): PackageDetailViewModel => {
  const { catalog } = input;
  const mcpResource = input.mcpResource.replace(/\/$/u, '');

  const functions = catalog.functions
    .map((fn) => {
      const id = formatFunctionId({
        functionSlug: fn.functionSlug,
        handle: fn.handle,
        packageSlug: fn.packageSlug,
      });
      return {
        description: readContractDescription(fn.contract),
        id,
        mcpSnippet: `POST ${mcpResource}/mcp\nTool: execute\nArguments: { "id": "${id}", "arguments": {} }`,
        slug: fn.functionSlug,
      };
    })
    .toSorted((left, right) => left.slug.localeCompare(right.slug));

  return {
    executions: input.executions,
    functions,
    handle: catalog.handle,
    isOwner: input.isOwner,
    organizationId: catalog.organizationId,
    organizationSlug: input.organizationSlug,
    packageSlug: catalog.packageSlug,
    publishedAt: catalog.currentVersion.publishedAt,
    semver: catalog.currentVersion.semver,
    visibility: catalog.visibility,
  };
};
