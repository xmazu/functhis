import { describe, expect, test } from 'bun:test';

import { invitationIdFromInviteResponse } from './organization-invite';

describe('invitationIdFromInviteResponse', () => {
  test('returns id when present', () => {
    expect(invitationIdFromInviteResponse({ id: 'inv-1' })).toBe('inv-1');
  });

  test('returns null for invalid payloads', () => {
    expect(invitationIdFromInviteResponse(null)).toBeNull();
    expect(invitationIdFromInviteResponse({ id: 1 })).toBeNull();
  });
});
