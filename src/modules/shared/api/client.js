export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const withTimeout = async (promise, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const parseEnvelope = async (response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

export const requestJson = async (path, { method = 'GET', token, body, timeoutMs } = {}) => {
  if (!token) {
    throw new ApiError('You must sign in to continue.', 401);
  }

  try {
    const response = await withTimeout(
      (signal) =>
        fetch(`${API_BASE_URL}${path}`, {
          method,
          signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        }),
      timeoutMs,
    );

    const envelope = await parseEnvelope(response);

    if (!response.ok || !envelope?.success) {
      const message = envelope?.error ?? `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, envelope);
    }

    return envelope.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error?.name === 'AbortError') {
      throw new ApiError('The request timed out. Please retry.', 408);
    }

    throw new ApiError('Network error. Please check your connection and retry.', 0);
  }
};

export const toUiError = (error) => {
  if (!(error instanceof ApiError)) {
    return 'Unexpected error. Please retry.';
  }

  if (error.message.includes('LLM Schema Validation Failed')) {
    return "The interviewer lost their train of thought. Let's try that again.";
  }

  return error.message;
};
