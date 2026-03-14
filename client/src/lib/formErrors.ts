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
