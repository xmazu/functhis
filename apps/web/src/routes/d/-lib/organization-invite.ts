export const invitationIdFromInviteResponse = (
  data: unknown
): string | null => {
  if (!data || typeof data !== 'object' || !('id' in data)) {
    return null;
  }
  const { id } = data as { id: unknown };
  return typeof id === 'string' && id.length > 0 ? id : null;
};
