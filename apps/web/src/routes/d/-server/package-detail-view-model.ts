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
  canWriteSecrets: boolean;
  executions: ExecutionSummaryRow[];
  functions: PackageDetailFunctionView[];
  handle: string;
  isOwner: boolean;
  missingSecretNames: string[];
  organizationId: string;
  organizationSlug: string | null;
  packageId: string;
  packageSlug: string;
  publishedAt: Date;
  secrets: { name: string; updatedAt: Date }[];
  semver: string;
  visibility: CatalogPackageRow['visibility'];
}

export const buildPackageDetailViewModel = (input: {
  canWriteSecrets: boolean;
  catalog: CatalogPackageRow;
  executions: PackageDetailViewModel['executions'];
  isOwner: boolean;
  mcpResource: string;
  missingSecretNames: string[];
  organizationSlug: string | null;
  secrets: PackageDetailViewModel['secrets'];
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
    canWriteSecrets: input.canWriteSecrets,
    executions: input.executions,
    functions,
    handle: catalog.handle,
    isOwner: input.isOwner,
    missingSecretNames: input.missingSecretNames,
    organizationId: catalog.organizationId,
    organizationSlug: input.organizationSlug,
    packageId: catalog.id,
    packageSlug: catalog.packageSlug,
    publishedAt: catalog.currentVersion.publishedAt,
    secrets: input.secrets,
    semver: catalog.currentVersion.semver,
    visibility: catalog.visibility,
  };
};
