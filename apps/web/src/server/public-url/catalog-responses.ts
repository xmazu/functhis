import { buildCatalogLoginUrl } from '../catalog/access';
import { wantsJsonCatalogResponse } from './accept';
import { catalogSignInHtmlResponse } from './catalog-pages';

export const catalogUnauthorizedResponse = (
  request: Request,
  consoleUrl: string
): Response => {
  if (request.method === 'GET' && !wantsJsonCatalogResponse(request)) {
    return catalogSignInHtmlResponse(request.url, consoleUrl);
  }

  return Response.json(
    {
      error: 'Unauthorized',
      loginUrl: buildCatalogLoginUrl(request.url),
    },
    { status: 401 }
  );
};
