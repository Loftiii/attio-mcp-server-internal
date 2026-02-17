/**
 * Keys that Attio does not accept in record value objects (e.g. in PATCH/POST body).
 * Sending these causes 400 "Unrecognized key".
 */
const RECORD_VALUE_STRIP_KEYS = ["attribute_type", "type"];

function stripUnrecognizedKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!RECORD_VALUE_STRIP_KEYS.includes(k)) out[k] = v;
  }
  return out;
}

/**
 * Normalize a single attribute's value into Attio's expected shape: an array of value objects.
 * - Primitives (string, number, boolean) → [{ value: primitive }]
 * - Array of primitives → [{ value: x }, ...]
 * - Single object (e.g. { value: "..." } or { email_address: "..." }) → [object] with strip
 * - Array of objects → each stripped of attribute_type/type, then passed through
 * PATCH and POST record APIs expect "attribute_slug": [{ ... }] and reject attribute_type in the body.
 */
function normalizeValueEntry(entry: unknown): Array<Record<string, unknown>> {
  if (entry === null || entry === undefined) return [];
  if (Array.isArray(entry)) {
    return entry.map((item) => {
      if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        return stripUnrecognizedKeys(item as Record<string, unknown>);
      }
      return { value: item };
    });
  }
  if (typeof entry === "object" && !Array.isArray(entry)) {
    return [stripUnrecognizedKeys(entry as Record<string, unknown>)];
  }
  return [{ value: entry }];
}

/**
 * Normalize record values for Attio PATCH/POST record APIs.
 * Ensures each attribute is an array of value objects and strips unrecognized keys (e.g. attribute_type).
 */
export function normalizeRecordValues(values: Record<string, unknown>): Record<string, Array<Record<string, unknown>>> {
  const out: Record<string, Array<Record<string, unknown>>> = {};
  for (const [key, val] of Object.entries(values)) {
    if (RECORD_VALUE_STRIP_KEYS.includes(key)) continue;
    out[key] = normalizeValueEntry(val);
  }
  return out;
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
  error?: unknown;
};

export function createErrorResult(
  error: Error,
  url: string,
  method: string,
  responseData: { status?: number; headers?: unknown; data?: unknown }
): ToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text:
          `ERROR: ${error.message}\n\n` +
          `=== Request Details ===\n` +
          `- Method: ${method}\n` +
          `- URL: ${url}\n\n` +
          `=== Response Details ===\n` +
          `- Status: ${responseData.status}\n` +
          `- Headers: ${JSON.stringify(responseData.headers || {}, null, 2)}\n` +
          `- Data: ${JSON.stringify(responseData.data || {}, null, 2)}\n`,
      },
    ],
    isError: true,
    error: {
      code: responseData.status || 500,
      message: error.message,
      details: responseData.data ?? "Unknown error occurred",
    },
  };
}
