/** Flatten an API response's field-level validation errors for FieldError, returning null when it isn't a validation error. */
export function extractFieldErrors(err: any): Record<string, string> | null {
  const data = err?.response?.data;
  if (!data?.errors || typeof data.errors !== 'object') return null;

  const fieldErrors: Record<string, string> = {};
  for (const [key, messages] of Object.entries(data.errors)) {
    if (Array.isArray(messages) && messages.length > 0) {
      fieldErrors[key] = messages[0];
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

/** Pick the most human-readable message from an API error, preferring a field-level one over the generic text. */
export function getApiErrorMessage(err: any, fallback = 'Something went wrong'): string {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;

  // Prefer a plain-string `errors` value, which the Mongoose error handler sometimes returns, over the generic message.
  if (typeof data.errors === 'string' && data.errors.trim()) {
    return data.errors;
  }

  // Field-level Zod errors: pick the first messages array we find.
  if (data.errors && typeof data.errors === 'object') {
    for (const messages of Object.values(data.errors)) {
      if (Array.isArray(messages) && messages.length > 0) {
        return messages[0];
      }
      if (typeof messages === 'string' && messages.trim()) {
        return messages;
      }
    }
  }

  return data.message || fallback;
}
