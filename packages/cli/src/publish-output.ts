import { formatFunctionId } from '@functhis/core/publish/function-id';
import type { PublishFinalizeResponse } from '@functhis/core/publish/schemas';

export const formatPublishResult = (
  result: PublishFinalizeResponse
): string[] => {
  const lines: string[] = [
    `Published @${result.handle}/${result.slug}@${result.semver}`,
  ];

  for (const fn of result.functions) {
    lines.push(
      `  ${formatFunctionId({
        functionSlug: fn.slug,
        handle: result.handle,
        packageSlug: result.slug,
      })}`
    );
  }

  return lines;
};
