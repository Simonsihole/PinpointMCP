#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const PORT = 31337;

// Store the latest payload in memory
let latestPayload = null;

// Initialize MCP Server
const server = new Server({
  name: "pinpoint-mcp",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
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
  const batch = req.body.batch || [];
  if (!batch.length) {
    return res.json({ success: false, error: "Empty batch" });
  }

  // Save the latest batch to memory and disk
  latestPayload = batch;
  require('fs').writeFileSync('.latest-payload.json', JSON.stringify(batch, null, 2));

  // Build the message summarizing the batch
  const instructionList = batch.map((p, i) => `${i + 1}. ${p.instruction}`).join('\n');
  const messageContent = `[Pinpoint Batch Request] Received ${batch.length} instruction(s):\n${instructionList}\n\nCall the read_pinpoint_payload tool to get the full DOM context and bounding boxes for all targets.`;

  server.notification({
    method: "notifications/message",
    params: {
      role: "user",
      content: messageContent
    }
  }).catch(() => {});
  
  // LOG TO STDERR so it doesn't corrupt the MCP JSON-RPC stdout stream
  console.error(`\n\n--- NEW PINPOINT BATCH DETECTED ---\n${instructionList}\nFile saved to: .latest-payload.json\n-------------------------------------\n\n`);
  
  res.json({ success: true, mcp_delivered: true });
});

// Start Express
app.listen(PORT, '127.0.0.1', () => {
  // Silence Express logs to not pollute stdio
});

// Start MCP Server on stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
