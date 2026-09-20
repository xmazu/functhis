export const publicPackagePath = (row: {
  handle: string;
  packageSlug: string;
}): string => `/@${row.handle}/${row.packageSlug}`;

export const publicFunctionPath = (row: {
  functionSlug: string;
  handle: string;
  packageSlug: string;
}): string => `/@${row.handle}/${row.packageSlug}/${row.functionSlug}`;
