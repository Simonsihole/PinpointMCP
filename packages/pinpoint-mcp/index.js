#!/usr/bin/env node

const path = require('path');
const os = require('os');
const fs = require('fs');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

// Shared with pinpoint-launcher, which is what actually receives the
// browser's POST /payload now (see README — the HTTP receiver moved there
// so it can also inject a trigger keystroke into the agent's pty; this
// process only ever talks to the agent over MCP stdio, so it has no
// terminal to "type" into). This file is the handoff point between the two.
const PAYLOAD_FILE = path.join(os.tmpdir(), 'pinpoint-mcp-latest-payload.json');

process.on('uncaughtException', (err) => {
  console.error('[pinpoint-mcp] Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[pinpoint-mcp] Unhandled rejection:', err);
});

const server = new Server({
  name: "pinpoint-mcp",
  version: "1.1.0"
}, {
  capabilities: {
    tools: {}
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: "read_pinpoint_payload",
      description: "Reads the most recent UI element selection payload sent from the Pinpoint React component. Call this whenever you're told a new Pinpoint batch is available.",
      inputSchema: { type: "object", properties: {} }
    }]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "read_pinpoint_payload") {
    let payload;
    try {
      const raw = fs.readFileSync(PAYLOAD_FILE, 'utf-8');
      payload = JSON.parse(raw);
    } catch {
      return { content: [{ type: "text", text: "No payload available." }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
    };
  }
  throw new Error("Tool not found");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
