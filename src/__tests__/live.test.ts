/**
 * Live tests against the Attio API (demo workspace).
 * Requires ATTIO_API_KEY (in env or .env). Suite is skipped when the key is missing.
 */
import "dotenv/config";
import axios from "axios";
import {
  getListToolsResponse,
  handleListResources,
  handleReadResource,
  handleToolCall,
} from "../handlers.js";

const hasApiKey = !!process.env.ATTIO_API_KEY;

function createApi(): ReturnType<typeof axios.create> {
  return axios.create({
    baseURL: "https://api.attio.com/v2",
    headers: {
      Authorization: `Bearer ${process.env.ATTIO_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
}

async function callTool(
  api: ReturnType<typeof axios.create>,
  name: string,
  args: Record<string, unknown> = {}
) {
  return handleToolCall(api, { params: { name, arguments: args } });
}

(hasApiKey ? describe : describe.skip)("Live MCP tools (demo workspace)", () => {
  let api: ReturnType<typeof createApi>;

  beforeAll(() => {
    if (!hasApiKey) return;
    api = createApi();
  });

  describe("ListTools", () => {
    it("returns 26 tools with name, description, inputSchema", () => {
      const { tools } = getListToolsResponse();
      expect(tools).toHaveLength(26);
      for (const tool of tools) {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(tool.inputSchema).toEqual(expect.any(Object));
      }
    });
  });

  describe("Resources", () => {
    it("ListResources returns resources with uri and name", async () => {
      const result = await handleListResources(api!, { params: {} });
      expect(result).toHaveProperty("resources");
      const res = (result as { resources?: unknown[] }).resources;
      expect(Array.isArray(res)).toBe(true);
      for (const r of res as Array<{ uri?: string; name?: string }>) {
        expect(r).toHaveProperty("uri");
        expect(r).toHaveProperty("name");
      }
    });

    it("ReadResource returns contents for a company URI", async () => {
      const list = await handleListResources(api!, { params: {} });
      const resources = (list as { resources?: Array<{ uri: string }> }).resources ?? [];
      if (resources.length === 0) {
        return; // skip if no companies
      }
      const uri = resources[0].uri;
      const result = await handleReadResource(api!, { params: { uri } });
      expect(result).toHaveProperty("contents");
      const contents = (result as { contents?: Array<{ uri: string; text: string; mimeType: string }> }).contents ?? [];
      expect(Array.isArray(contents)).toBe(true);
      expect(contents[0]).toMatchObject({
        uri,
        mimeType: "application/json",
      });
    });
  });

  describe("Companies", () => {
    it("search-companies returns results for query", async () => {
      const result = await callTool(api!, "search-companies", { query: "test" });
      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
    });

    it("read-company-details returns details for a company URI", async () => {
      const search = await callTool(api!, "search-companies", { query: "test" });
      if (search.isError || !search.content[0].text) return;
      const match = search.content[0].text.match(/attio:\/\/companies\/([a-f0-9-]+)/);
      if (!match) return;
      const uri = `attio://companies/${match[1]}`;
      const result = await callTool(api!, "read-company-details", { uri });
      expect(result.isError).toBe(false);
    });
  });

  describe("Objects and attributes", () => {
    it("list-objects returns objects", async () => {
      const result = await callTool(api!, "list-objects", {});
      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual(expect.any(Array));
    });

    it("get-object(people) returns object schema", async () => {
      const result = await callTool(api!, "get-object", { object: "people" });
      expect(result.isError).toBe(false);
    });

    it("list-attributes(people) returns attributes", async () => {
      const result = await callTool(api!, "list-attributes", { object: "people" });
      expect(result.isError).toBe(false);
    });
  });

  describe("Records", () => {
    let createdRecordId: string | null = null;
    const objectSlug = "companies";
    const createValues = { name: "MCP Test Company" };

    it("query-records returns records", async () => {
      const result = await callTool(api!, "query-records", { object: objectSlug, limit: 2 });
      expect(result.isError).toBe(false);
    });

    it("create-record creates a record", async () => {
      const result = await callTool(api!, "create-record", {
        object: objectSlug,
        values: createValues,
      });
      expect(result.isError).toBe(false);
      const idMatch = result.content[0].text.match(/attio:\/\/companies\/([a-f0-9-]+)/);
      if (idMatch) createdRecordId = idMatch[1];
    });

    it("get-record returns the created record", async () => {
      if (!createdRecordId) return;
      const result = await callTool(api!, "get-record", {
        object: objectSlug,
        recordId: createdRecordId,
      });
      expect(result.isError).toBe(false);
    });

    it("update-record updates the record", async () => {
      if (!createdRecordId) return;
      const result = await callTool(api!, "update-record", {
        object: objectSlug,
        recordId: createdRecordId,
        values: { name: "MCP Test Company Updated" },
      });
      expect(result.isError).toBe(false);
    });

    it("delete-record cleans up", async () => {
      if (!createdRecordId) return;
      const result = await callTool(api!, "delete-record", {
        object: objectSlug,
        recordId: createdRecordId,
      });
      expect(result.isError).toBe(false);
    });
  });

  describe("Tasks", () => {
    it("list-tasks returns tasks", async () => {
      const result = await callTool(api!, "list-tasks", { limit: 2 });
      expect(result.isError).toBe(false);
    });

    it("create-task creates a task", async () => {
      const result = await callTool(api!, "create-task", {
        content: "MCP test task",
      });
      expect(result.isError).toBe(false);
    });

    it("get-task and update-task", async () => {
      const list = await callTool(api!, "list-tasks", { limit: 1 });
      if (list.isError || !list.content[0].text) return;
      const data = JSON.parse(list.content[0].text);
      const taskId = data[0]?.id?.task_id;
      if (!taskId) return;
      const get = await callTool(api!, "get-task", { taskId });
      expect(get.isError).toBe(false);
      const update = await callTool(api!, "update-task", {
        taskId,
        is_completed: false,
      });
      expect(update.isError).toBe(false);
    });
  });

  describe("Meetings", () => {
    it("list-meetings returns meetings", async () => {
      const result = await callTool(api!, "list-meetings", { limit: 2 });
      expect(result.isError).toBe(false);
    });
  });

  describe("Comments", () => {
    let commentId: string | null = null;
    let recordId: string | null = null;
    let workspaceMemberId: string | null = null;

    beforeAll(async () => {
      const query = await callTool(api!, "query-records", { object: "companies", limit: 1 });
      if (query.isError || !query.content[0].text) return;
      const records = JSON.parse(query.content[0].text);
      const rec = records[0];
      if (rec?.id?.record_id) recordId = rec.id.record_id;
      const peopleRes = await callTool(api!, "query-records", { object: "people", limit: 1 });
      if (peopleRes.isError || !peopleRes.content[0].text) return;
      const people = JSON.parse(peopleRes.content[0].text);
      const person = people[0];
      if (person?.id?.record_id) {
        const getRec = await callTool(api!, "get-record", {
          object: "people",
          recordId: person.id.record_id,
        });
        if (!getRec.isError && getRec.content[0].text) {
          const doc = JSON.parse(getRec.content[0].text);
          const owner = doc.data?.values?.owner?.value?.actor_id ?? doc.data?.values?.owner?.[0]?.value?.actor_id;
          if (owner) workspaceMemberId = owner;
        }
      }
      if (!workspaceMemberId) {
        try {
          const me = await api!.get("/workspace_members/me");
          workspaceMemberId = me.data?.data?.id?.workspace_member_id ?? null;
        } catch {
          // Endpoint may not exist or return 400 in some workspaces; leave null so comment tests skip
        }
      }
    });

    it("create-comment requires (object + record_id) or thread_id", async () => {
      const result = await callTool(api!, "create-comment", {
        content: "Test",
        author_workspace_member_id: "00000000-0000-0000-0000-000000000000",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/object \+ record_id|list \+ entry_id|thread_id/);
    });

    it("create-comment, list-threads, get-comment, delete-comment", async () => {
      if (!recordId || !workspaceMemberId) return;
      const create = await callTool(api!, "create-comment", {
        content: "MCP test comment",
        author_workspace_member_id: workspaceMemberId,
        object: "companies",
        record_id: recordId,
      });
      expect(create.isError).toBe(false);
      const idMatch = create.content[0].text.match(/Comment created: ([a-f0-9-]+)/);
      if (idMatch) commentId = idMatch[1];
      if (!commentId) return;
      const listThreads = await callTool(api!, "list-threads", {
        object: "companies",
        record_id: recordId,
      });
      expect(listThreads.isError).toBe(false);
      const getComment = await callTool(api!, "get-comment", { commentId });
      expect(getComment.isError).toBe(false);
      const del = await callTool(api!, "delete-comment", { commentId });
      expect(del.isError).toBe(false);
    });
  });
});
