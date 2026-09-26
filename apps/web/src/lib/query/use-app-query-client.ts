import type { QueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';

import type { RouterAppContext } from '#/routes/__root';

export const useAppQueryClient = (): QueryClient => {
  const { queryClient } = useRouteContext({
    from: '__root__',
  }) as RouterAppContext;
  return queryClient;
};
