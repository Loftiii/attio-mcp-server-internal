# MCP Server Expansion Plan

## Implementation status

| Category | Tools | Status |
|----------|--------|--------|
| Objects & schema | list-objects, get-object, list-attributes, create-attribute, update-attribute | Done |
| Records | query-records, get-record, create-record, update-record, delete-record | Done |
| Comments | create-comment (record/entry/thread), list-threads, get-comment, delete-comment | Done |
| Tasks | list-tasks, create-task, get-task, update-task | Done |
| Meetings | list-meetings, get-meeting | Done |
| Call recordings | list-call-recordings, get-call-recording | Done |
| Optional (not implemented) | assert-record, meetings as resources, transcript for call recording, select/status options | Pending / deferred |

---

This document outlines how to add the following to the Attio MCP server:

- **Objects & attributes** – create and manage objects and their attributes
- **Write to all record types** – generic CRUD for any object (companies, people, deals, custom)
- **Comments** – create and view comments on records/entries/threads
- **Tasks** – list, create, and manage tasks
- **Meetings** – list and view meetings
- **Call recordings** – list and view call recordings (and transcripts) for meetings

---

## 1. Objects & attributes

**Attio API**

- **List objects:** `GET /v2/objects` – returns all objects (people, companies, deals, custom). Scope: `object_configuration:read`.
- **Get object:** `GET /v2/objects/{object}` – single object by slug or UUID. Scope: `object_configuration:read`.
- **List attributes:** `GET /v2/objects/{object}/attributes` – attributes for an object. Scope: `object_configuration:read`.
- **Create attribute:** `POST /v2/objects/{object}/attributes`. Scope: `object_configuration:read-write`.
- **Update attribute:** `PATCH /v2/objects/{object}/attributes/{attribute}`. Scope: `object_configuration:read-write`.

**MCP additions**

- **Tools:** `list-objects`, `get-object`, `list-attributes`, `create-attribute`, `update-attribute` (and optionally list/create/update select options and statuses).

---

## 2. Generic record CRUD (all record types)

**Attio API**

- **Query records:** `POST /v2/objects/{object}/records/query` – filter, sort, limit, offset. Scope: `record_permission:read`, `object_configuration:read`.
- **Get record:** `GET /v2/objects/{object}/records/{record_id}`. Scope: same.
- **Create record:** `POST /v2/objects/{object}/records` – body `{ data: { values: { "attribute_slug": value, ... } } }`. Scope: `record_permission:read-write`, `object_configuration:read`.
- **Update record:** `PATCH /v2/objects/{object}/records/{record_id}` – same values shape. Scope: same.
- **Assert record:** `PUT /v2/objects/{object}/records` – create or update by unique attribute. Optional for “upsert” behavior.
- **Delete record:** `DELETE /v2/objects/{object}/records/{record_id}`. Scope: `record_permission:read-write`.

**MCP additions**

- **Tools:**
  - `query-records` – params: `object` (slug e.g. `people`, `companies`, `deals`), optional `filter`, `sorts`, `limit`, `offset`.
  - `get-record` – params: `object`, `recordId`.
  - `create-record` – params: `object`, `values` (JSON object keyed by attribute api_slug).
  - `update-record` – params: `object`, `recordId`, `values`.
  - `delete-record` – params: `object`, `recordId` (use with care; optional).

Existing company-specific tools can remain for convenience; generic tools cover all objects.

---

## 3. Comments

**Attio API**

- **Create comment:** `POST /v2/comments` – body can target:
  - **Record:** `data: { format, content, author: { type, id }, record: { object, record_id } }`.
  - **Entry:** `data: { ..., entry: { list, entry_id } }`.
  - **Thread (reply):** `data: { ..., thread_id }`.
- **Get comment:** `GET /v2/comments/{comment_id}`. Scope: `comment:read`.
- **List threads** (e.g. for a record): `GET /v2/threads?parent_object=...&parent_record_id=...`. Scope: `comment:read`.
- **Delete comment:** `DELETE /v2/comments/{comment_id}`. Scope: `comment:read-write`.

**MCP additions**

- **Tools:** `create-comment` (on record or entry or thread), `list-threads` (for record/entry), `get-comment`, optional `delete-comment`.

---

## 4. Tasks

**Attio API**

- **List tasks:** `GET /v2/tasks` – query params: `limit`, `offset`, `sort`, `linked_object`, `linked_record_id`, `assignee`, `is_completed`. Scope: `task:read`, `object_configuration:read`, `record_permission:read`, `user_management:read`.
- **Create task:** `POST /v2/tasks` – body: content (plaintext), format, optional `deadline_at`, `is_completed`, `linked_records`, `assignees`. Scope: `task:read-write`, etc.
- **Get task:** `GET /v2/tasks/{task_id}`. Scope: same as list.
- **Update task:** `PATCH /v2/tasks/{task_id}` – e.g. mark complete, change deadline. Scope: `task:read-write`.

**MCP additions**

- **Tools:** `list-tasks`, `create-task`, `get-task`, `update-task` (e.g. set `is_completed`).

---

## 5. Meetings

**Attio API**

- **List meetings:** `GET /v2/meetings` – params: `limit`, `cursor`, `linked_object`, `linked_record_id`, `participants`, `sort`, `ends_from`, `starts_before`, `timezone`. Scope: `meeting:read`, `record_permission:read`.
- **Get meeting:** `GET /v2/meetings/{meeting_id}`. Scope: same.

**MCP additions**

- **Tools:** `list-meetings`, `get-meeting`. Optional **resources:** e.g. “upcoming meetings” as a resource the LLM can read.

---

## 6. Call recordings

**Attio API**

- **List call recordings:** `GET /v2/meetings/{meeting_id}/call_recordings`. Scope: `meeting:read`, `call_recording:read`.
- **Get call recording:** `GET /v2/meetings/{meeting_id}/call_recordings/{call_recording_id}`. Scope: same.
- Transcripts/speakers are typically part of the call recording or separate transcript endpoints.

**MCP additions**

- **Tools:** `list-call-recordings` (params: `meetingId`), `get-call-recording` (params: `meetingId`, `callRecordingId`). Optionally a tool to get transcript for a recording.

---

## Implementation order

1. **Phase 1 – Generic records + discovery**  
   Add `list-objects`, `list-attributes`, `query-records`, `get-record`, `create-record`, `update-record`. This gives “write to all record types” and the schema context (objects/attributes).

2. **Phase 2 – Tasks, meetings, call recordings**  
   Add `list-tasks`, `create-task`, `get-task`, `update-task`; `list-meetings`, `get-meeting`; `list-call-recordings`, `get-call-recording`. Pure read (+ task create/update) with clear APIs.

3. **Phase 3 – Comments**  
   Add `list-threads`, `create-comment`, `get-comment` (and optionally `delete-comment`). Comments require author (workspace member ID) for create.

4. **Phase 4 – Objects/attributes management (optional)**  
   Add `create-attribute`, `update-attribute`, and optionally list/create/update select options and statuses if you need the MCP to change schema, not just data.

---

## OAuth scopes (API key / token)

For full functionality, the Attio token should have at least:

- `object_configuration:read` (and `read-write` if creating/updating attributes)
- `record_permission:read` and `record_permission:read-write`
- `comment:read` and `comment:read-write`
- `task:read` and `task:read-write`
- `note:read` and `note:read-write` (already used for notes)
- `meeting:read` (and `meeting:read-write` if you add meeting create/update later)
- `call_recording:read` (and `call_recording:read-write` if you add create)
- `user_management:read` (for tasks and comment author resolution)

If using a bearer token from the API Explorer, ensure these scopes are enabled for that token (or use OAuth and request them).

---

## Code structure suggestion

- Keep a single `src/index.ts` for a small server, or split by domain:
  - `src/handlers/records.ts` – generic record CRUD + query
  - `src/handlers/objects.ts` – list/get objects, list/create/update attributes
  - `src/handlers/comments.ts` – comments and threads
  - `src/handlers/tasks.ts` – tasks
  - `src/handlers/meetings.ts` – meetings and call recordings
- Share one Axios instance and `createErrorResult` in a small `src/api.ts` or at the top of `index.ts`.
- Register all tools in `ListToolsRequestSchema` and route in `CallToolRequestSchema` by tool name (or by prefix if you group by domain).

This plan gives a clear path to “create and manage objects/attributes, write to all record types, comment, create tasks, and look at meetings and call recordings” in the MCP.
