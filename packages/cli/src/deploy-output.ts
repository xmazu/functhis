import { formatFunctionId } from '@functhis/deploy/function-id';
import {
  publicFunctionPath,
  publicPackagePath,
} from '@functhis/deploy/public-paths';
import type { DeployFinalizeResponse } from '@functhis/deploy/schemas';

export const formatDeployResult = (
  webOrigin: string,
  result: DeployFinalizeResponse
): string[] => {
  const origin = webOrigin.replace(/\/$/u, '');
  const lines: string[] = [
    `Deployed @${result.handle}/${result.slug}`,
    `  ${origin}${publicPackagePath({
      handle: result.handle,
      packageSlug: result.slug,
    })}`,
  ];

  for (const fn of result.functions) {
    lines.push(
      `  ${origin}${publicFunctionPath({
        functionSlug: fn.slug,
        handle: result.handle,
        packageSlug: result.slug,
      })}`,
      `  MCP: ${formatFunctionId({
        functionSlug: fn.slug,
        handle: result.handle,
        packageSlug: result.slug,
      })}`
    );
  }

  return lines;
};
