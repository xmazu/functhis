import { describe, expect, it } from 'bun:test';

import { formatStripeCatalogEnv } from './sync-stripe-catalog';

describe('formatStripeCatalogEnv', () => {
  it('maps developer price to STRIPE_PRO_PRICE_ID alias', () => {
    const lines = formatStripeCatalogEnv({
      developerPriceId: 'price_dev',
      teamPriceId: 'price_team',
    });
    expect(lines).toContain('STRIPE_PRICE_DEVELOPER_MONTHLY=price_dev');
    expect(lines).toContain('STRIPE_PRICE_TEAM_MONTHLY=price_team');
    expect(lines).toContain('STRIPE_PRO_PRICE_ID=price_dev');
  });
});
