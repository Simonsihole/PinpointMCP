#!/usr/bin/env node

const path = require('path');
const os = require('os');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const PORT = 31337;

// Written to the OS temp dir (not process.cwd()) because this process is
// usually spawned by an AI agent / MCP client with an unpredictable, and
// sometimes read-only, working directory.
const PAYLOAD_FILE = path.join(os.tmpdir(), 'pinpoint-mcp-latest-payload.json');

// Store the latest payload in memory
let latestPayload = null;

// Don't let one bad request or a protocol edge case silently kill the whole
// stdio connection to the AI agent — log it loudly instead so it's debuggable.
process.on('uncaughtException', (err) => {
  console.error('[pinpoint-mcp] Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[pinpoint-mcp] Unhandled rejection:', err);
});

// Initialize MCP Server
const server = new Server({
  name: "pinpoint-mcp",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {},
    // Required for the notifications/message log hint sent in the
    // /payload handler below — without this the SDK rejects the
    // notification outright (previously swallowed silently by an empty
    // .catch(), so the "wake up" notification was never actually sent).
    logging: {}
  }
});

// Expose a tool to read the latest pinpoint payload
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: "read_pinpoint_payload",
      description: "Reads the most recent UI element selection payload sent from the Pinpoint React component.",
      inputSchema: { type: "object", properties: {} }
    }]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "read_pinpoint_payload") {
    if (!latestPayload) {
      return { content: [{ type: "text", text: "No payload available." }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(latestPayload, null, 2) }]
    };
  }
  throw new Error("Tool not found");
});

// Setup Express to receive payloads from the React component
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/payload', (req, res) => {
  const batch = req.body?.batch || [];
  if (!batch.length) {
    return res.status(400).json({ success: false, error: "Empty batch" });
  }

  // Save the latest batch to memory (this is what the read_pinpoint_payload
  // tool actually serves) and best-effort to disk for manual debugging.
  // The disk write is a convenience, not the source of truth, so a failure
  // here (read-only tmpdir, disk full, etc.) must never break the request.
  latestPayload = batch;
  try {
    fs.writeFileSync(PAYLOAD_FILE, JSON.stringify(batch, null, 2));
  } catch (err) {
    console.error(`[pinpoint-mcp] Could not write debug payload file: ${err.message}`);
  }

  // Build the message summarizing the batch
  const instructionList = batch.map((p, i) => `${i + 1}. ${p.instruction}`).join('\n');

  // NOTE: "notifications/message" is the MCP *logging* notification — most
  // clients surface it as a log line, not as a message injected into the
  // model's context. There is currently no standard MCP mechanism to force
  // an idle agent to react mid-conversation, so this is a best-effort nudge,
  // not a guarantee. The reliable path is the agent calling
  // read_pinpoint_payload — either because it noticed this log, or because
  // the user asked it to check.
  server.notification({
    method: "notifications/message",
    params: {
      level: "info",
      logger: "pinpoint-mcp",
      data: `Received ${batch.length} new Pinpoint instruction(s). Call read_pinpoint_payload to fetch them:\n${instructionList}`
    }
  }).catch((err) => {
    console.error(`[pinpoint-mcp] Failed to send notification: ${err.message}`);
  });

  // LOG TO STDERR so it doesn't corrupt the MCP JSON-RPC stdout stream
  console.error(`\n\n--- NEW PINPOINT BATCH DETECTED ---\n${instructionList}\nDebug copy saved to: ${PAYLOAD_FILE}\n-------------------------------------\n\n`);

  res.json({ success: true, mcp_delivered: true });
});

// Surface malformed JSON bodies as a proper JSON error instead of falling
// through to Express's default HTML error page (which would make the React
// client's `!res.ok` check report a misleading "can't connect" toast).
app.use((err, _req, res, _next) => {
  console.error(`[pinpoint-mcp] Bad request: ${err.message}`);
  res.status(400).json({ success: false, error: "Invalid request body" });
});

// Start Express. If the port is already taken — most likely a previous
// Pinpoint server instance still running — log a clear reason instead of
// letting an unhandled 'error' event crash the whole stdio MCP connection.
const httpServer = app.listen(PORT, '127.0.0.1', () => {
  // Silence Express logs to not pollute stdio
});
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[pinpoint-mcp] Port ${PORT} is already in use — another Pinpoint server may already be running. The MCP tool connection will stay up, but the browser extension can't reach this instance. If this port shouldn't be in use, stop the other process and restart your AI agent.`);
  } else {
    console.error(`[pinpoint-mcp] Local server failed to start: ${err.message}`);
  }
});

// Start MCP Server on stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
