#!/usr/bin/env node
/**
 * local-api/mcp-server.js
 *
 * Stdio MCP server that connects local AI assistants (Claude Desktop,
 * Cursor) to the local Express dev server (server.js) at
 * http://localhost:3000 — never directly to the real Craft Connect API, so
 * the capability token never has to be configured in the assistant itself.
 *
 * Usage:
 *   npm run start   # in one terminal, keep server.js running
 *   npm run mcp     # or point Claude Desktop / Cursor's MCP config at this file
 *
 * Claude Desktop config example (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "craft-local-api": {
 *         "command": "node",
 *         "args": ["/absolute/path/to/local-api/mcp-server.js"]
 *       }
 *     }
 *   }
 */

const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const fetch = require("node-fetch");

const LOCAL_API_BASE = process.env.LOCAL_API_BASE ?? `http://localhost:${process.env.PORT ?? "3000"}`;

const server = new McpServer({
  name: "craft-local-api",
  version: "1.0.0",
});

server.registerTool(
  "list_documents",
  {
    title: "List Craft documents",
    description: "Lists documents via the local dev server's /api/documents endpoint.",
    inputSchema: {},
  },
  async () => {
    const data = await callLocalApi("GET", "/api/documents");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  "list_blocks",
  {
    title: "List Craft blocks",
    description: "Lists blocks via the local dev server's /api/blocks endpoint.",
    inputSchema: {},
  },
  async () => {
    const data = await callLocalApi("GET", "/api/blocks");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  "create_block",
  {
    title: "Create a Craft block",
    description: "Creates a block via the local dev server's POST /api/blocks endpoint.",
    inputSchema: {
      documentId: z.string().describe("The document to add the block to"),
      markdown: z.string().describe("Markdown content for the new block"),
    },
  },
  async ({ documentId, markdown }) => {
    const data = await callLocalApi("POST", "/api/blocks", { documentId, markdown });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

async function callLocalApi(method, urlPath, body) {
  const res = await fetch(`${LOCAL_API_BASE}${urlPath}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`local-api ${method} ${urlPath} failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
