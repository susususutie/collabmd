import { t, translateServerMessage } from '../i18n/index.js';

export function createRequestHeaders(requestId, headers = {}) {
  const nextHeaders = { ...headers };
  if (requestId) {
    nextHeaders['X-CollabMD-Request-Id'] = String(requestId);
  }

  return nextHeaders;
}

export async function parseApiResponse(response, fallbackKey, fallbackParams) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    // Known server prompts are translated here; raw error details pass through unchanged.
    const message = data.error ? translateServerMessage(data.error) : t(fallbackKey, fallbackParams);
    const error = new Error(message);
    error.status = response.status;
    error.body = data;
    if (typeof data?.code === 'string') {
      error.code = data.code;
    }
    throw error;
  }

  return data;
}
