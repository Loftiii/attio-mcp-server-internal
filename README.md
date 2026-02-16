# attio-mcp-server

This is an MCP server for [Attio](https://attio.com/), the AI-native CRM. It allows mcp clients (like Claude) to connect to the Attio API.

#### Current Capabilities

**Resources**

- List companies (by last interaction), read company by URI (`attio://companies/{id}`)

**Tools**

- **Companies (convenience):** search-companies, read-company-details, read-company-notes, create-company-note
- **Objects & schema:** list-objects, get-object, list-attributes, create-attribute, update-attribute
- **Records (any object):** query-records, get-record, create-record, update-record, delete-record
- **Tasks:** list-tasks, create-task, get-task, update-task
- **Meetings:** list-meetings, get-meeting
- **Call recordings:** list-call-recordings, get-call-recording
- **Comments:** create-comment (record, entry, or thread reply), list-threads, get-comment, delete-comment

**Required scopes (API key / OAuth)**

For full functionality, the Attio token should have: `object_configuration:read` (and `read-write` for create/update attribute), `record_permission:read` and `record_permission:read-write`, `comment:read` and `comment:read-write`, `task:read` and `task:read-write`, `note:read` and `note:read-write`, `meeting:read`, `call_recording:read`, `user_management:read`. When using a bearer token from the API Explorer, ensure these scopes are enabled.

## Usage

You will need:

- `ATTIO_API_KEY` 

This is expected to be a *bearer token* which means you can get one through the [API Explorer](https://developers.attio.com/reference/get_v2-objects) on the right hand side or configure OAuth and retrieve one throught the Attio API.


### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "attio": {
      "command": "npx",
      "args": ["attio-mcp-server"],
      "env": {
        "ATTIO_API_KEY": "YOUR_ATTIO_API_KEY"
      }
    }
  }
}
```
## Development

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (recommended v22 or higher)
- npm
- git
- dotenv

### Setting up Development Environment

To set up the development environment, follow these steps:

1. Fork the repository

   - Click the "Fork" button in the top-right corner of this repository
   - This creates your own copy of the repository under your Github acocunt

1. Clone Your Fork:

   ```sh
   git clone https://github.com/YOUR_USERNAME/attio-mcp-server.git
   cd attio-mcp-server
   ```

1. Add Upstream Remote
   ```sh
   git remote add upstream https://github.com/hmk/attio-mcp-server.git
   ```

1. Copy the dotenv file
    ```sh
    cp .env.template .env
    ```

1. Install dependencies:

   ```sh
   npm install
   ```

1. Run watch to keep index.js updated:

   ```sh
   npm run build:watch
   ```

1. Start the model context protocol development server:

   ```sh
   dotenv npx @modelcontextprotocol/inspector node PATH_TO_YOUR_CLONED_REPO/dist/index.js
   ```

1. If the development server did not load the environment variable correctly, set the `ATTIO_API_KEY` on the left-hand side of the mcp inspector.