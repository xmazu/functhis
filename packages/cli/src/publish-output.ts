import { formatFunctionId } from '@functhis/publish/function-id';
import {
  publicFunctionPath,
  publicPackagePath,
} from '@functhis/publish/public-paths';
import type { PublishFinalizeResponse } from '@functhis/publish/schemas';

export const formatPublishResult = (
  webOrigin: string,
  result: PublishFinalizeResponse
): string[] => {
  const origin = webOrigin.replace(/\/$/u, '');
  const lines: string[] = [
    `Published @${result.handle}/${result.slug}@${result.semver}`,
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
