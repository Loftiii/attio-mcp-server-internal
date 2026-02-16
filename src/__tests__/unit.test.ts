/**
 * Unit tests (no API). Tool schema and validation error messages.
 */
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
