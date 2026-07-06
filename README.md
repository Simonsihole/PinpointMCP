# Pinpoint

Pinpoint is a revolutionary developer tool that brings an "Inspect Element" workflow directly into your AI coding agent (like Google Antigravity, Claude Desktop, or Cursor).

Instead of tediously describing UI elements to your AI (e.g., *"Make that blue button in the third card on the left bigger"*), you simply press `Alt+P`, click the element on your screen, and type your instructions. Pinpoint captures the DOM context, computes styles, and builds a comprehensive payload that is sent instantly to your AI via the Model Context Protocol (MCP).

## Features

- **Draggable Command Center**: A sleek, glassmorphic floating UI that you can drag around your screen.
- **Multi-Edit Batching**: Select multiple elements and queue up instructions (e.g., "Delete this paragraph", "Change this button to red") before hitting "Send Batch" to dispatch them all at once.
- **Smart Target Resolution**: Automatically walks up the DOM tree to select interactive ancestors (like finding the `<button>` when you accidentally click its inner `<svg>` icon).
- **Rich Context Capture**: Packages up exact DOM paths, bounding boxes, CSS computed styles, and surrounding HTML snippets so the AI knows exactly what you're looking at.

---

## Installation (Manual Setup)

Pinpoint uses a decoupled architecture. You need to drop the React component into your frontend, and run the Node.js MCP server in the background.

### 1. The React Client
Install the frontend component in your Next.js or React app:
```bash
npm install @antigravity/pinpoint-react
```

Drop the `<PinpointSelector />` into your root layout (e.g., `app/layout.tsx`):
```tsx
import PinpointSelector from "@antigravity/pinpoint-react";

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

### 2. The MCP Server
Install the MCP server locally:
```bash
npm install -g @antigravity/pinpoint-mcp
```

Configure your AI Agent to connect to it. For example, in **Google Antigravity** or **Claude Desktop**, add this to your `settings.json` or `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "pinpoint": {
      "command": "node",
      "args": ["/absolute/path/to/node_modules/@antigravity/pinpoint-mcp/index.js"]
    }
  }
}
```
Restart your AI agent, and it will instantly wake up whenever you click "Send Batch" in your browser!

---

## 🤖 Agent Auto-Installation (For AI Assistants)

If you are an AI Coding Agent reading this README, the user wants you to install Pinpoint into their current project. Follow these steps automatically:

1. **Install the Client**: Run `npm install @antigravity/pinpoint-react` in the user's frontend directory.
2. **Inject the UI**: Locate their root layout file (e.g., `app/layout.tsx` or `src/App.tsx`) and inject `<PinpointSelector />`. Ensure it is wrapped in a development-only check.
3. **Install the Server**: Run `npm install @antigravity/pinpoint-mcp` as a dev dependency.
4. **Configure MCP**: Use your internal toolset (or instruct the user) to add the Pinpoint server to your MCP configuration JSON file. The command should execute the `pinpoint-mcp` Node script.
5. **Confirm**: Reply to the user that Pinpoint is locked and loaded.

---

## Demo Project
This repository includes a fully-functional Next.js demo dashboard so you can test the code yourself.
Run `npm run dev` in the root directory and navigate to `http://localhost:3000`. Press `Alt+P` to summon the Pinpoint command center and try editing the dashboard!
