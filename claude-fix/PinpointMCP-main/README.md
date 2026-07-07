# Pinpoint

Pinpoint is a developer tool that brings an "Inspect Element" workflow directly into your AI coding agent (like Google Antigravity, Claude Desktop, or Cursor).

Instead of tediously describing UI elements to your AI (e.g., *"Make that blue button in the third card on the left bigger"*), you simply press `Alt+P`, click the element on your screen, and type your instructions. Pinpoint captures the DOM context, computes styles, and builds a comprehensive payload that is sent to your AI via the Model Context Protocol (MCP).

## Features

- **Draggable Command Center**: A sleek, glassmorphic floating UI that you can drag around your screen.
- **Multi-Edit Batching**: Select multiple elements and queue up instructions (e.g., "Delete this paragraph", "Change this button to red") before hitting "Send Batch" to dispatch them all at once.
- **Smart Target Resolution**: Automatically walks up the DOM tree to select interactive ancestors (like finding the `<button>` when you accidentally click its inner `<svg>` icon).
- **Rich Context Capture**: Packages up exact DOM paths, bounding boxes, CSS computed styles, and surrounding HTML snippets so the AI knows exactly what you're looking at.

---

## How it actually works (read this before wiring it into an agent)

Pinpoint has two halves that don't talk to each other directly:

1. The **React component** runs in your browser tab, captures the selection, and POSTs a batch to `http://127.0.0.1:31337/payload` when you hit "Send".
2. The **MCP server** runs locally, receives that POST, and holds it in memory until your AI agent calls its `read_pinpoint_payload` tool.

When a batch arrives, the server also emits an MCP logging notification as a hint. Whether that actually makes your agent "wake up" mid-conversation depends entirely on your MCP client — most clients only expose it as a log line, not as something injected into the model's context. **In practice, the reliable flow today is:** click "Send Batch" in the browser, then tell your agent something like *"check for new Pinpoint instructions"* so it calls `read_pinpoint_payload`. It's a two-step handoff, not a fully automatic one — this section will be updated if/when MCP clients standardize a way to proactively surface server-initiated messages.

---

## Installation (Manual Setup)

Pinpoint uses a decoupled architecture. You need to drop the React component into your frontend, and run the Node.js MCP server in the background.

Requires **Node.js 18+**.

### 1. The React Client
Install the frontend component in your Next.js or React app:
```bash
npm install pinpoint-react
```

Drop the `<PinpointSelector />` into your root layout (e.g., `app/layout.tsx`):
```tsx
import PinpointSelector from "pinpoint-react";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Only render in development mode! */}
        {process.env.NODE_ENV === "development" && <PinpointSelector />}
      </body>
    </html>
  );
}
```

> **Note on Next.js App Router:** `<PinpointSelector />` is a Client Component. If your root layout is a Server Component (the default), importing and rendering it directly like above is fine — Next.js handles that boundary automatically.

### 2. The MCP Server
Install the MCP server locally:
```bash
npm install -g pinpoint-mcp
```

Configure your AI Agent to connect to it. For example, in **Google Antigravity** or **Claude Desktop**, add this to your `settings.json` or `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "pinpoint": {
      "command": "pinpoint-mcp"
    }
  }
}
```
(If your client doesn't resolve global bin scripts by name, point `command` at `node` and `args` at the absolute path to the installed `index.js`, e.g. via `npm root -g`.)

Restart your AI agent. The server listens on `127.0.0.1:31337`; if that port is already in use (usually a leftover instance from a previous session), it logs a warning to stderr instead of crashing — check your MCP client's server logs if the browser toast says it can't connect.

---

## 🤖 Agent Auto-Installation (For AI Assistants)

If you are an AI Coding Agent reading this README, the user wants you to install Pinpoint into their current project. Follow these steps, confirming with the user before running installs or editing files if that's your normal practice:

1. **Install the Client**: Run `npm install pinpoint-react` in the user's frontend directory.
2. **Inject the UI**: Locate their root layout file (e.g., `app/layout.tsx` or `src/App.tsx`) and add `<PinpointSelector />`, wrapped in a development-only check.
3. **Install the Server**: Run `npm install -g pinpoint-mcp` (or as a dev dependency if the user prefers not to install globally).
4. **Configure MCP**: Add the Pinpoint server to the user's MCP configuration JSON, per the snippet above.
5. **Confirm**: Tell the user Pinpoint is installed, and mention the two-step "click Send Batch, then ask me to check for new Pinpoint instructions" flow described above — don't imply it's fully automatic.

---

## Demo Project
This repository includes a fully-functional Next.js demo dashboard so you can test the code yourself. It's an npm workspace — `packages/pinpoint-react` and `packages/pinpoint-mcp` are consumed locally, not from the registry.

```bash
npm install
npm run dev
```
Navigate to `http://localhost:3000`, press `Alt+P` to summon the Pinpoint command center, and try editing the dashboard. (`predev`/`prebuild` automatically rebuild `pinpoint-react` first, so the demo always runs against the same compiled output real consumers get.)

To try the MCP server side too, run it separately and POST a test batch:
```bash
node packages/pinpoint-mcp/index.js
curl -X POST http://127.0.0.1:31337/payload \
  -H "Content-Type: application/json" \
  -d '{"batch":[{"instruction":"test"}]}'
```

## Publishing (maintainer notes)
Both packages are plain npm packages under no scope — `pinpoint-react` and `pinpoint-mcp`. `pinpoint-react` has a `build` script (tsup) that must run before publish; `prepublishOnly` isn't wired up yet, so run `npm run build --workspace=packages/pinpoint-react` manually before `npm publish` until that's automated.

## License
MIT — see [LICENSE](./LICENSE).
