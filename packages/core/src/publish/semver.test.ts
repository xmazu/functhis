import { describe, expect, test } from 'bun:test';

import {
  bumpSemver,
  compareSemver,
  highestSemver,
  isValidSemver,
} from './semver';

describe('bumpSemver', () => {
  test('starts at 1.0.0 when no previous version exists', () => {
    expect(bumpSemver(null, 'patch')).toBe('1.0.0');
    expect(bumpSemver(null, 'major')).toBe('1.0.0');
  });

  test('bumps major, minor, and patch', () => {
    expect(bumpSemver('1.2.3', 'major')).toBe('2.0.0');
    expect(bumpSemver('1.2.3', 'minor')).toBe('1.3.0');
    expect(bumpSemver('1.2.3', 'patch')).toBe('1.2.4');
  });

  test('starts at 1.0.0 when the current value is not semver', () => {
    expect(bumpSemver('not-a-version', 'patch')).toBe('1.0.0');
  });
});

describe('highestSemver', () => {
  test('returns the greatest published version', () => {
    expect(highestSemver(['1.0.0', '1.2.0', '1.1.9'])).toBe('1.2.0');
  });

  test('ignores invalid versions and returns null when none are valid', () => {
    expect(highestSemver(['beta', '1.0.0', 'latest'])).toBe('1.0.0');
    expect(highestSemver(['beta', 'latest'])).toBeNull();
    expect(highestSemver([])).toBeNull();
  });
});

describe('compareSemver', () => {
  test('orders by major then minor then patch', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareSemver('1.2.0', '1.1.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });

  test('falls back to string compare when a value is not semver', () => {
    expect(compareSemver('beta', 'alpha')).toBeGreaterThan(0);
  });
});

describe('isValidSemver', () => {
  test('accepts major.minor.patch integers', () => {
    expect(isValidSemver('1.0.0')).toBe(true);
    expect(isValidSemver('1.0.0-beta')).toBe(false);
    expect(isValidSemver('01.0.0')).toBe(true);
  });
});
