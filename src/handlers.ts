/**
 * MCP request handlers (ListTools, ListResources, ReadResource, CallTool).
 * Extracted for testability; index.ts delegates to these.
 */
import type { AxiosInstance } from "axios";
import { createErrorResult } from "./api.js";
import { TOOLS } from "./tool-definitions.js";

function getResponseData(error: unknown): { status?: number; headers?: unknown; data?: unknown } {
  const err = error as { response?: { status?: number; headers?: unknown; data?: unknown } };
  return err?.response ?? { status: 500, headers: {}, data: {} };
}

export function getListToolsResponse() {
  return { tools: TOOLS };
}

export async function handleListResources(
  api: AxiosInstance,
  _request: { params?: { uri?: string } }
) {
  const path = "/objects/companies/records/query";
  try {
    const response = await api.post(path, {
      limit: 20,
      sorts: [{ attribute: "last_interaction", field: "interacted_at", direction: "desc" }],
    });
    const companies = response.data.data || [];
    return {
      resources: companies.map((company: { id?: { record_id?: string }; values?: { name?: Array<{ value?: string }> } }) => ({
        uri: `attio://companies/${company.id?.record_id}`,
        name: company.values?.name?.[0]?.value || "Unknown Company",
        mimeType: "application/json",
      })),
      description: `Found ${companies.length} companies that you have interacted with most recently`,
    };
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error("Unknown error"),
      path,
      "POST",
      getResponseData(error)
    );
  }
}

export async function handleReadResource(
  api: AxiosInstance,
  request: { params?: { uri?: string } }
) {
  const uri = request.params?.uri ?? "";
  const companyId = uri.replace("attio://companies/", "");
  const path = `/objects/companies/records/${companyId}`;
  try {
    const response = await api.get(path);
    return {
      contents: [
        {
          uri,
          text: JSON.stringify(response.data, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error("Unknown error"),
      path,
      "GET",
      getResponseData(error)
    );
  }
}

export type CallToolRequest = {
  params: { name: string; arguments?: Record<string, unknown> };
};

export async function handleToolCall(
  api: AxiosInstance,
  request: CallToolRequest
): Promise<{ content: Array<{ type: "text"; text: string }>; isError: boolean; error?: unknown }> {
  const toolName = request.params.name;
  const args = request.params.arguments ?? {};

  try {
    if (toolName === "search-companies") {
      const query = args.query as string;
      const path = "/objects/companies/records/query";
      try {
        const response = await api.post(path, {
          filter: { name: { $contains: query } },
        });
        const results = response.data.data || [];
        const companies = (results as { values?: { name?: Array<{ value?: string }> }; id?: { record_id?: string } }[])
          .map((company) => {
            const companyName = company.values?.name?.[0]?.value || "Unknown Company";
            const companyId = company.id?.record_id || "Record ID not found";
            return `${companyName}: attio://companies/${companyId}`;
          })
          .join("\n");
        return {
          content: [{ type: "text", text: `Found ${results.length} companies:\n${companies}` }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "POST",
          getResponseData(error)
        );
      }
    }

    if (toolName === "read-company-details") {
      const uri = args.uri as string;
      const companyId = uri.replace("attio://companies/", "");
      const path = `/objects/companies/records/${companyId}`;
      try {
        const response = await api.get(path);
        return {
          content: [
            {
              type: "text",
              text: `Company details for ${companyId}:\n${JSON.stringify(response.data, null, 2)}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "read-company-notes") {
      const uri = args.uri as string;
      const limit = (args.limit as number) || 10;
      const offset = (args.offset as number) || 0;
      const companyId = uri.replace("attio://companies/", "");
      const path = `/notes?limit=${limit}&offset=${offset}&parent_object=companies&parent_record_id=${companyId}`;
      try {
        const response = await api.get(path);
        const notes = response.data.data || [];
        return {
          content: [
            {
              type: "text",
              text: `Found ${notes.length} notes for company ${companyId}:\n${(notes as object[]).map((note) => JSON.stringify(note)).join("----------\n")}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "create-company-note") {
      const companyId = args.companyId as string;
      const noteTitle = args.noteTitle as string;
      const noteText = args.noteText as string;
      const url = "notes";
      try {
        const response = await api.post(url, {
          data: {
            format: "plaintext",
            parent_object: "companies",
            parent_record_id: companyId,
            title: `[AI] ${noteTitle}`,
            content: noteText,
          },
        });
        return {
          content: [
            {
              type: "text",
              text: `Note added to company ${companyId}: attio://notes/${response.data?.id?.note_id}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          url,
          "POST",
          getResponseData(error)
        );
      }
    }

    if (toolName === "list-objects") {
      const path = "/objects";
      try {
        const response = await api.get(path);
        const objects = response.data.data || [];
        return {
          content: [{ type: "text", text: JSON.stringify(objects, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "list-attributes") {
      const objectSlug = args.object as string;
      const path = `/objects/${objectSlug}/attributes`;
      try {
        const response = await api.get(path);
        const attributes = response.data.data || [];
        return {
          content: [{ type: "text", text: JSON.stringify(attributes, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "query-records") {
      const objectSlug = args.object as string;
      const limit = (args.limit as number) ?? 20;
      const offset = (args.offset as number) ?? 0;
      const filter = args.filter as object | undefined;
      const sorts = args.sorts as { attribute?: string; direction?: string }[] | undefined;
      const path = `/objects/${objectSlug}/records/query`;
      try {
        const body: { limit: number; offset: number; filter?: object; sorts?: unknown[] } = { limit, offset };
        if (filter) body.filter = filter;
        if (sorts?.length) body.sorts = sorts;
        const response = await api.post(path, body);
        const records = response.data.data || [];
        return {
          content: [{ type: "text", text: JSON.stringify(records, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "POST",
          getResponseData(error)
        );
      }
    }

    if (toolName === "get-record") {
      const objectSlug = args.object as string;
      const recordId = args.recordId as string;
      const path = `/objects/${objectSlug}/records/${recordId}`;
      try {
        const response = await api.get(path);
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "create-record") {
      const objectSlug = args.object as string;
      const values = args.values as Record<string, unknown>;
      const path = `/objects/${objectSlug}/records`;
      try {
        const response = await api.post(path, { data: { values } });
        const id = response.data?.data?.id;
        const recordId = id?.record_id ?? response.data?.id?.record_id;
        return {
          content: [
            {
              type: "text",
              text: recordId
                ? `Created record: attio://${objectSlug}/${recordId}\n${JSON.stringify(response.data, null, 2)}`
                : JSON.stringify(response.data, null, 2),
            },
          ],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "POST",
          getResponseData(error)
        );
      }
    }

    if (toolName === "update-record") {
      const objectSlug = args.object as string;
      const recordId = args.recordId as string;
      const values = args.values as Record<string, unknown>;
      const path = `/objects/${objectSlug}/records/${recordId}`;
      try {
        const response = await api.patch(path, { data: { values } });
        return {
          content: [{ type: "text", text: `Updated record ${recordId}.\n${JSON.stringify(response.data, null, 2)}` }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "PATCH",
          getResponseData(error)
        );
      }
    }

    if (toolName === "delete-record") {
      const objectSlug = args.object as string;
      const recordId = args.recordId as string;
      const path = `/objects/${objectSlug}/records/${recordId}`;
      try {
        await api.delete(path);
        return {
          content: [{ type: "text", text: `Record ${recordId} deleted.` }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "DELETE",
          getResponseData(error)
        );
      }
    }

    if (toolName === "get-object") {
      const objectSlug = args.object as string;
      const path = `/objects/${objectSlug}`;
      try {
        const response = await api.get(path);
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "create-attribute") {
      const objectSlug = args.object as string;
      const title = args.title as string;
      const api_slug = args.api_slug as string;
      const type = args.type as string;
      const description = (args.description as string) ?? null;
      const is_required = (args.is_required as boolean) ?? false;
      const is_unique = (args.is_unique as boolean) ?? false;
      const is_multiselect = (args.is_multiselect as boolean) ?? false;
      const config = (args.config as object) ?? {};
      const path = `/objects/${objectSlug}/attributes`;
      try {
        const response = await api.post(path, {
          data: {
            title,
            description,
            api_slug,
            type,
            is_required,
            is_unique,
            is_multiselect,
            config,
          },
        });
        const attrId = response.data?.data?.id?.attribute_id ?? response.data?.id?.attribute_id;
        return {
          content: [
            {
              type: "text",
              text: attrId
                ? `Attribute created: ${attrId}\n${JSON.stringify(response.data, null, 2)}`
                : JSON.stringify(response.data, null, 2),
            },
          ],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "POST",
          getResponseData(error)
        );
      }
    }

    if (toolName === "update-attribute") {
      const objectSlug = args.object as string;
      const attribute = args.attribute as string;
      const path = `/objects/${objectSlug}/attributes/${attribute}`;
      const data: Record<string, unknown> = {};
      if (args.title !== undefined) data.title = args.title;
      if (args.description !== undefined) data.description = args.description;
      if (args.api_slug !== undefined) data.api_slug = args.api_slug;
      if (args.is_required !== undefined) data.is_required = args.is_required;
      if (args.is_unique !== undefined) data.is_unique = args.is_unique;
      if (args.is_archived !== undefined) data.is_archived = args.is_archived;
      if (args.config !== undefined) data.config = args.config;
      try {
        const response = await api.patch(path, { data });
        return {
          content: [{ type: "text", text: `Attribute updated.\n${JSON.stringify(response.data, null, 2)}` }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "PATCH",
          getResponseData(error)
        );
      }
    }

    if (toolName === "list-tasks") {
      const limit = (args.limit as number) ?? 20;
      const offset = (args.offset as number) ?? 0;
      const linked_object = args.linked_object as string | undefined;
      const linked_record_id = args.linked_record_id as string | undefined;
      const is_completed = args.is_completed as boolean | undefined;
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (linked_object) params.set("linked_object", linked_object);
      if (linked_record_id) params.set("linked_record_id", linked_record_id);
      if (typeof is_completed === "boolean") params.set("is_completed", String(is_completed));
      const path = `/tasks?${params.toString()}`;
      try {
        const response = await api.get(path);
        const tasks = response.data.data || [];
        return {
          content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "create-task") {
      const content = args.content as string;
      const deadline_at = args.deadline_at as string | undefined;
      const linked_records = args.linked_records as Array<{ target_object: string; target_record_id: string }> | undefined;
      const path = "/tasks";
      try {
        const body = {
          data: {
            content,
            format: "plaintext",
            deadline_at: deadline_at ?? null,
            is_completed: false,
            linked_records: linked_records?.length
              ? linked_records.map((r) => ({ target_object: r.target_object, target_record_id: r.target_record_id }))
              : [],
            assignees: [],
          },
        };
        const response = await api.post(path, body);
        const taskId = response.data?.data?.id?.task_id ?? response.data?.id?.task_id;
        return {
          content: [
            {
              type: "text",
              text: taskId
                ? `Created task: ${taskId}\n${JSON.stringify(response.data, null, 2)}`
                : JSON.stringify(response.data, null, 2),
            },
          ],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "POST",
          getResponseData(error)
        );
      }
    }

    if (toolName === "get-task") {
      const taskId = args.taskId as string;
      const path = `/tasks/${taskId}`;
      try {
        const response = await api.get(path);
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "update-task") {
      const taskId = args.taskId as string;
      const is_completed = args.is_completed as boolean | undefined;
      const deadline_at = args.deadline_at as string | undefined;
      const content = args.content as string | undefined;
      const path = `/tasks/${taskId}`;
      try {
        const data: Record<string, unknown> = {};
        if (typeof is_completed === "boolean") data.is_completed = is_completed;
        if (deadline_at !== undefined) data.deadline_at = deadline_at;
        if (content !== undefined) data.content = content;
        const response = await api.patch(path, { data });
        return {
          content: [{ type: "text", text: `Updated task ${taskId}.\n${JSON.stringify(response.data, null, 2)}` }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "PATCH",
          getResponseData(error)
        );
      }
    }

    if (toolName === "list-meetings") {
      const limit = (args.limit as number) ?? 50;
      const linked_object = args.linked_object as string | undefined;
      const linked_record_id = args.linked_record_id as string | undefined;
      const sort = args.sort as string | undefined;
      const params = new URLSearchParams({ limit: String(limit) });
      if (linked_object) params.set("linked_object", linked_object);
      if (linked_record_id) params.set("linked_record_id", linked_record_id);
      if (sort) params.set("sort", sort);
      const path = `/meetings?${params.toString()}`;
      try {
        const response = await api.get(path);
        const meetings = response.data.data || [];
        return {
          content: [{ type: "text", text: JSON.stringify(meetings, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "get-meeting") {
      const meetingId = args.meetingId as string;
      const path = `/meetings/${meetingId}`;
      try {
        const response = await api.get(path);
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "list-call-recordings") {
      const meetingId = args.meetingId as string;
      const path = `/meetings/${meetingId}/call_recordings`;
      try {
        const response = await api.get(path);
        const recordings = response.data.data || [];
        return {
          content: [{ type: "text", text: JSON.stringify(recordings, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "get-call-recording") {
      const meetingId = args.meetingId as string;
      const callRecordingId = args.callRecordingId as string;
      const path = `/meetings/${meetingId}/call_recordings/${callRecordingId}`;
      try {
        const response = await api.get(path);
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "create-comment") {
      const content = args.content as string;
      const author_workspace_member_id = args.author_workspace_member_id as string;
      const objectSlug = args.object as string;
      const record_id = args.record_id as string;
      const list = args.list as string | undefined;
      const entry_id = args.entry_id as string | undefined;
      const thread_id = args.thread_id as string | undefined;
      const path = "/comments";
      try {
        const data: Record<string, unknown> = {
          format: "plaintext",
          content,
          author: { type: "workspace-member", id: author_workspace_member_id },
        };
        if (thread_id) {
          data.thread_id = thread_id;
        } else if (list && entry_id) {
          data.entry = { list, entry_id };
        } else if (objectSlug && record_id) {
          data.record = { object: objectSlug, record_id };
        } else {
          return {
            content: [
              {
                type: "text",
                text: "Error: provide either (object + record_id), (list + entry_id), or thread_id.",
              },
            ],
            isError: true,
          };
        }
        const response = await api.post(path, { data });
        const commentId = response.data?.data?.id?.comment_id ?? response.data?.id?.comment_id;
        return {
          content: [
            {
              type: "text",
              text: commentId
                ? `Comment created: ${commentId}\n${JSON.stringify(response.data, null, 2)}`
                : JSON.stringify(response.data, null, 2),
            },
          ],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "POST",
          getResponseData(error)
        );
      }
    }

    if (toolName === "list-threads") {
      const objectSlug = args.object as string | undefined;
      const record_id = args.record_id as string | undefined;
      const list = args.list as string | undefined;
      const entry_id = args.entry_id as string | undefined;
      const limit = (args.limit as number) ?? 10;
      const offset = (args.offset as number) ?? 0;
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (objectSlug && record_id) {
        params.set("object", objectSlug);
        params.set("record_id", record_id);
      } else if (list && entry_id) {
        params.set("list", list);
        params.set("entry_id", entry_id);
      } else {
        return {
          content: [
            {
              type: "text",
              text: "Error: provide either (object + record_id) or (list + entry_id).",
            },
          ],
          isError: true,
        };
      }
      const path = `/threads?${params.toString()}`;
      try {
        const response = await api.get(path);
        const threads = response.data.data || [];
        return {
          content: [{ type: "text", text: JSON.stringify(threads, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "get-comment") {
      const commentId = args.commentId as string;
      const path = `/comments/${commentId}`;
      try {
        const response = await api.get(path);
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "GET",
          getResponseData(error)
        );
      }
    }

    if (toolName === "delete-comment") {
      const commentId = args.commentId as string;
      const path = `/comments/${commentId}`;
      try {
        await api.delete(path);
        return {
          content: [{ type: "text", text: `Comment ${commentId} deleted.` }],
          isError: false,
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error : new Error("Unknown error"),
          path,
          "DELETE",
          getResponseData(error)
        );
      }
    }

    throw new Error("Tool not found");
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool '${toolName}': ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}
