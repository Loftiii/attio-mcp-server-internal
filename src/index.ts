#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import {
  getListToolsResponse,
  handleListResources,
  handleReadResource,
  handleToolCall,
} from "./handlers.js";

// Configure Axios instance with Attio API credentials from environment
const api = axios.create({
  baseURL: "https://api.attio.com/v2",
  headers: {
    Authorization: `Bearer ${process.env.ATTIO_API_KEY}`,
    "Content-Type": "application/json",
  },
});

const server = new Server(
  {
    name: "attio-mcp-server",
    version: "0.0.1",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

server.setRequestHandler(ListResourcesRequestSchema, (request) =>
  handleListResources(api, request as { params?: { uri?: string } })
);

server.setRequestHandler(ReadResourceRequestSchema, (request) =>
  handleReadResource(api, request as { params?: { uri?: string } })
);

server.setRequestHandler(ListToolsRequestSchema, () => getListToolsResponse());

server.setRequestHandler(CallToolRequestSchema, (request) =>
  handleToolCall(api, request)
);

// Main function
async function main() {
  try {
    if (!process.env.ATTIO_API_KEY) {
      throw new Error("ATTIO_API_KEY environment variable not found");
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
