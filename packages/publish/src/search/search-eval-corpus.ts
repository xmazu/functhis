export const SEARCH_EVAL_CORPUS = {
  catalog: [
    {
      functionSlug: 'users/search',
      handle: 'acme',
      id: '@acme/crm/users/search',
      packageSlug: 'crm',
      searchText:
        'users/search\nResolve a workspace user from an email address\nemail',
    },
    {
      functionSlug: 'users/list',
      handle: 'acme',
      id: '@acme/crm/users/list',
      packageSlug: 'crm',
      searchText: 'users/list\nList users in the workspace',
    },
    {
      functionSlug: 'invoices/search',
      handle: 'acme',
      id: '@acme/billing/invoices/search',
      packageSlug: 'billing',
      searchText: 'invoices/search\nLocate an invoice given a number\nnumber',
    },
    {
      functionSlug: 'hello-world',
      handle: 'acme',
      id: '@acme/crm/hello-world',
      packageSlug: 'crm',
      searchText: 'hello-world\nSay hello to the user\nsay hi',
    },
  ],
  queries: [
    {
      kind: 'synonym' as const,
      query: 'find the customer by email',
      relevant: ['@acme/crm/users/search'],
    },
    {
      kind: 'zero-overlap' as const,
      query: 'find the client by mail',
      relevant: ['@acme/crm/users/search'],
    },
    {
      kind: 'exact-id' as const,
      query: '@acme/crm/users/search',
      relevant: ['@acme/crm/users/search'],
    },
    {
      kind: 'no-match' as const,
      query: 'quantum flux calibration',
      relevant: [],
    },
    {
      kind: 'zero-overlap' as const,
      query: 'user wants to say hi',
      relevant: ['@acme/crm/hello-world'],
    },
  ],
};
