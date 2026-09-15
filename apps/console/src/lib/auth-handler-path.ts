export const resolveAuthHandlerPath = (pathname: string): string => {
  if (pathname.startsWith('/api/auth')) {
    return pathname;
  }
  return `/api/auth${pathname}`;
};
