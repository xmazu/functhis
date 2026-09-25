export const formatPackageDate = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatPackageDateTime = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
};

export const toPackageIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;
