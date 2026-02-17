/**
 * Unit tests (no API). Tool schema and validation error messages.
 */
import { normalizeRecordValues } from "../api.js";
import { getListToolsResponse, handleToolCall } from "../handlers.js";
import { TOOLS } from "../tool-definitions.js";

describe("Tool list schema", () => {
  it("exports 26 tools", () => {
    expect(TOOLS).toHaveLength(26);
  });

  it("getListToolsResponse returns tools array with 26 items", () => {
    const { tools } = getListToolsResponse();
    expect(tools).toHaveLength(26);
  });

  it("each tool has name, description, inputSchema", () => {
    const { tools } = getListToolsResponse();
    for (const tool of tools) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("inputSchema");
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(tool.inputSchema).toEqual(expect.any(Object));
      expect(tool.inputSchema).toHaveProperty("type", "object");
      if ("required" in tool.inputSchema && Array.isArray((tool.inputSchema as { required?: string[] }).required)) {
        expect((tool.inputSchema as { required: string[] }).required).toEqual(expect.any(Array));
      }
    }
  });
});

describe("Validation errors (mock api)", () => {
  const mockApi = {
    get: async () => ({ data: {} }),
    post: async () => ({ data: {} }),
    patch: async () => ({ data: {} }),
    delete: async () => {},
  } as unknown as ReturnType<typeof import("axios")["create"]>;

  it("create-comment without (object+record_id), (list+entry_id), or thread_id returns isError true and mentions target", async () => {
    const result = await handleToolCall(mockApi, {
      params: {
        name: "create-comment",
        arguments: {
          content: "Hi",
          author_workspace_member_id: "00000000-0000-0000-0000-000000000000",
        },
      },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/object \+ record_id|list \+ entry_id|thread_id/);
  });

  it("list-threads without (object+record_id) or (list+entry_id) returns isError true", async () => {
    const result = await handleToolCall(mockApi, {
      params: {
        name: "list-threads",
        arguments: {},
      },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/object \+ record_id|list \+ entry_id/);
  });

  it("unknown tool name throws and is caught as isError true", async () => {
    const result = await handleToolCall(mockApi, {
      params: { name: "nonexistent-tool", arguments: {} },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Tool not found|Error executing tool/);
  });
});

describe("normalizeRecordValues (PATCH/POST record payload)", () => {
  it("wraps string in [{ value }]", () => {
    expect(normalizeRecordValues({ name: "Acme" })).toEqual({ name: [{ value: "Acme" }] });
  });

  it("wraps number and boolean in [{ value }]", () => {
    expect(normalizeRecordValues({ count: 42 })).toEqual({ count: [{ value: 42 }] });
    expect(normalizeRecordValues({ active: true })).toEqual({ active: [{ value: true }] });
  });

  it("converts array of primitives to array of value objects", () => {
    expect(normalizeRecordValues({ tags: ["a", "b"] })).toEqual({
      tags: [{ value: "a" }, { value: "b" }],
    });
  });

  it("passes through array of value objects and strips attribute_type", () => {
    expect(
      normalizeRecordValues({
        description: [{ value: "Text", attribute_type: "text" }],
      })
    ).toEqual({ description: [{ value: "Text" }] });
  });

  it("wraps single value object in array and strips attribute_type", () => {
    expect(
      normalizeRecordValues({
        description: { value: "Only one", attribute_type: "text" },
      })
    ).toEqual({ description: [{ value: "Only one" }] });
  });

  it("preserves email_address and other non-value keys", () => {
    expect(
      normalizeRecordValues({
        primary_email: [{ email_address: "hi@example.com" }],
      })
    ).toEqual({ primary_email: [{ email_address: "hi@example.com" }] });
  });

  it("skips attribute_type at top level", () => {
    expect(normalizeRecordValues({ attribute_type: "text", name: "X" } as unknown as Record<string, unknown>)).toEqual(
      { name: [{ value: "X" }] }
    );
  });

  it("handles null/undefined by returning empty array for that key", () => {
    expect(normalizeRecordValues({ name: null, desc: undefined } as unknown as Record<string, unknown>)).toEqual({
      name: [],
      desc: [],
    });
  });
});
