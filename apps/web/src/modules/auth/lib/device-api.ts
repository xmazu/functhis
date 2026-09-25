export interface DeviceVerification {
  client_id?: string;
  scope?: string;
  status: string;
  user_code: string;
}

const readErrorMessage = async (response: Response): Promise<string> => {
  const message = await response.text();
  return message.length > 0 ? message : response.statusText;
};

export const lookupDeviceCode = async (
  userCode: string
): Promise<DeviceVerification> => {
  const response = await fetch(
    `/api/auth/device?user_code=${encodeURIComponent(userCode)}`,
    { credentials: 'include' }
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as DeviceVerification;
};

export const postDeviceAction = async (
  path: '/api/auth/device/approve' | '/api/auth/device/deny',
  userCode: string
): Promise<void> => {
  const response = await fetch(path, {
    body: JSON.stringify({ userCode }),
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
};
