import { describe, expect, test } from 'bun:test';

import { orgUsageBoost, USAGE_BOOST_CAP } from './ranking-boost';

describe('orgUsageBoost', () => {
  test('caps the boost and ignores execution success', () => {
    const now = Date.now();
    const boost = orgUsageBoost(
      [
        { atMs: now, exposures: 1, position: 1, selected: true },
        { atMs: now, exposures: 1, position: 2, selected: true },
      ],
      now
    );
    expect(boost).toBeGreaterThan(0);
    expect(boost).toBeLessThanOrEqual(USAGE_BOOST_CAP);
  });

  test('decays older selections', () => {
    const now = Date.now();
    const recent = orgUsageBoost(
      [{ atMs: now, exposures: 1, position: 1, selected: true }],
      now
    );
    const old = orgUsageBoost(
      [
        {
          atMs: now - 60 * 86_400_000,
          exposures: 1,
          position: 1,
          selected: true,
        },
      ],
      now
    );
    expect(recent).toBeGreaterThan(old);
  });
});
