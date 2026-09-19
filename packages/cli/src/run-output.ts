export const formatRunResponseBody = (
  response: Response,
  bodyText: string
): string => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return bodyText;
  }
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    return bodyText;
  }
};
