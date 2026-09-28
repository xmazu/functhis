export const isExactSearchMatch = (
  query: string,
  row: { functionSlug: string; handle: string; packageSlug: string }
): boolean => {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }
  return (
    row.functionSlug.toLowerCase() === normalized ||
    row.packageSlug.toLowerCase() === normalized ||
    row.handle.toLowerCase() === normalized ||
    `@${row.handle}/${row.packageSlug}/${row.functionSlug}`.toLowerCase() ===
      normalized
  );
};
