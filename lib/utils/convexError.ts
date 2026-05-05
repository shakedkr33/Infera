export function getConvexErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return typeof error === 'string' ? error : null;
  }

  const maybeError = error as {
    data?: { code?: unknown };
    message?: unknown;
  };
  if (typeof maybeError.data?.code === 'string') {
    return maybeError.data.code;
  }

  if (typeof maybeError.message === 'string') {
    const match = maybeError.message.match(/[A-Z0-9_]{8,}/);
    return match?.[0] ?? null;
  }

  return null;
}
