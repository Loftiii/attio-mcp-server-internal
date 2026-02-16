/**
 * Shared API helper for MCP handlers.
 */
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
