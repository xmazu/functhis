export const wantsJsonCatalogResponse = (request: Request): boolean => {
  const accept = request.headers.get('Accept') ?? '';
  return accept.includes('application/json');
};
