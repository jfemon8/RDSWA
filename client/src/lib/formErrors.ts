/**
 * Extracts field-level validation errors from an API error response.
 * Backend returns: { success: false, message: "Validation failed", errors: { fieldName: ["msg"] } }
 * Returns a flat Record<string, string> for use with FieldError components.
 * Returns null if the error is not a validation error (should fall back to toast).
 */
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

/**
 * Extracts the best human-readable error message from an API error.
 * Prioritizes field-level validation messages over generic "Validation failed".
 * Use this in onError handlers: toast.error(getApiErrorMessage(err, 'Fallback'))
 */
export function getApiErrorMessage(err: any, fallback = 'Something went wrong'): string {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;

  // Mongoose error handler in middleware sometimes returns `errors` as a
  // plain string (e.g. "Notice validation failed: attachments.0: ..."). Show
  // that instead of the generic top-level message when present.
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
