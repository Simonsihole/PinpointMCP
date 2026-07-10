# 🎯 Pinpoint

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

Pinpoint is a developer tool that brings an "Inspect Element" workflow directly into your AI coding agent (like Google Antigravity, Claude Code, OpenCode, or Cursor).

Instead of tediously describing UI elements to your AI (e.g., *"Make that blue button in the third card on the left bigger"*), you simply press `Alt+P`, click the element on your screen, and type your instructions. Pinpoint captures the DOM context, computes styles, and builds a comprehensive payload that is sent to your AI via the Model Context Protocol (MCP).

## Features

- **Draggable Command Center**: A sleek, glassmorphic floating UI that you can drag around your screen.
- **Multi-Edit Batching**: Select multiple elements and queue up instructions (e.g., "Delete this paragraph", "Change this button to red") before hitting "Send Batch" to dispatch them all at once.
- **Smart Target Resolution**: Automatically walks up the DOM tree to select interactive ancestors (like finding the `<button>` when you accidentally click its inner `<svg>` icon).
- **Rich Context Capture**: Packages up exact DOM paths, bounding boxes, CSS computed styles, and surrounding HTML snippets so the AI knows exactly what you're looking at.

---

## How it actually works (read this before wiring it into an agent)

Pinpoint has three parts:

1. **The React component** runs in your browser tab, captures the selection, and POSTs a batch to `http://127.0.0.1:31337/payload` when you hit "Send".
2. **The launcher** (`pinpoint-launcher`) runs your actual agent CLI — OpenCode, Antigravity (`agy`), Claude Code, Codex, aider, or anything else that's a terminal program — wrapped in a pty. It receives that POST directly and, once the agent has gone quiet for a moment (so it never interrupts an in-progress response), writes a real keystroke sequence into the wrapped process's stdin. This is indistinguishable from you typing "check pinpoint" and hitting Enter yourself.
3. **The MCP server** (`pinpoint-mcp`) is what your agent talks to over MCP for the actual `read_pinpoint_payload` tool call. It reads a small shared file that the launcher writes to — it doesn't run its own HTTP server anymore.

**Why it's split this way:** the MCP server is a child process your agent spawns purely for JSON-RPC tool calls. It has no access to the terminal you're typing into, so it can never "type" into the agent's TUI itself. MCP's own notification mechanism (`notifications/message`) is a passive log line — there's no standard MCP mechanism to force an idle agent to start a new turn. The launcher sidesteps this entirely by *being* the terminal the agent runs in, so it can inject input directly, regardless of which agent you're using.

**This only works for terminal/TUI-based agents.** It does **not** help with GUI-only clients (the Cursor IDE panel, Claude Desktop's chat window) since there's no equivalent "wrap the input" hook for those — the two-step "click Send, then ask the agent to check" flow still applies there.

### Running your agent through the launcher
Install it once:
```bash
npm install -g pinpoint-launcher
```
Then start your agent through it instead of running it directly — no `--` needed for a plain command:
```bash
pinpoint-launch agy         # Antigravity CLI
pinpoint-launch opencode    # OpenCode
pinpoint-launch claude      # Claude Code
pinpoint-launch codex       # Codex CLI
```
If your agent's own command takes flags, put `--` before it so the launcher doesn't try to parse them as its own:
```bash
pinpoint-launch -- claude --model sonnet
pinpoint-launch --port 31337 -- aider --model gpt-4
```
Everything you type still passes straight through — the launcher is invisible until a batch arrives. A few things it handles for you automatically:
- **Debouncing:** rapid "Send Batch" clicks within ~400ms are coalesced into a single injected message.
- **Idle-detection:** if the agent is actively streaming a response when a batch arrives, the launcher waits for a quiet moment before injecting, so it never interrupts mid-output — capped at 5 seconds so it never waits forever either.

Optional flags:
```bash
pinpoint-launch --port 31337 --trigger "Check Pinpoint now" --quiet-ms 600 --max-wait-ms 5000 -- opencode
```
| Flag | Default | Meaning |
|---|---|---|
| `--port` | `31337` | HTTP port to receive batches on (must match the browser client) |
| `--trigger` | auto-generated | Fixed text to inject instead of the default summary message |
| `--quiet-ms` | `600` | How long the agent must be silent before injecting |
| `--max-wait-ms` | `5000` | Inject anyway after this long, even if the agent hasn't gone quiet |

`pinpoint-launch --help` prints this at any time.

**Native dependency note:** `pinpoint-launcher` depends on `node-pty`, which has native bindings. Most platforms get a prebuilt binary automatically; if none is available for your OS/Node version, npm will try to compile it, which needs standard build tools installed first — Xcode Command Line Tools (macOS), `build-essential` + `python3` (Linux), or Visual Studio Build Tools (Windows).

### Troubleshooting
- **"Port already in use"** — another `pinpoint-launch` instance is probably still running from a previous session. Stop it, or pass a different `--port` (and update the browser client to match).
- **Agent doesn't react to the injected message** — increase `--max-wait-ms` if your agent's TUI redraws/animates constantly (e.g. a spinner) in a way that never looks "quiet"; the cap guarantees injection eventually happens regardless.
- **Command not found** — `pinpoint-launch <cmd>` fails immediately with a clear error if `<cmd>` isn't installed or on your `PATH`; install/alias it the same way you normally would, then point the launcher at it.

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

Restart your AI agent.

### 3. The Launcher (for instant auto-trigger, terminal agents only)
If your agent runs in a terminal (OpenCode, Antigravity CLI, Claude Code, Codex, aider, etc.) and you want batches to trigger it automatically instead of typing "check pinpoint" yourself every time:
```bash
npm install -g pinpoint-launcher
pinpoint-launch agy
```
This is what now binds `127.0.0.1:31337` (the MCP server no longer does — see the architecture note above). If your agent is a GUI-only client (Cursor's IDE panel, Claude Desktop), skip this step; the two-step "click Send Batch, then ask me to check" flow still applies there.

---

## 🤖 Agent Auto-Installation (For AI Assistants)

If you are an AI Coding Agent reading this README, the user wants you to install Pinpoint into their current project. Follow these steps, confirming with the user before running installs or editing files if that's your normal practice:

1. **Install the Client**: Run `npm install pinpoint-react` in the user's frontend directory.
2. **Inject the UI**: Locate their root layout file (e.g., `app/layout.tsx` or `src/App.tsx`) and add `<PinpointSelector />`, wrapped in a development-only check.
3. **Install the Server**: Run `npm install -g pinpoint-mcp` (or as a dev dependency if the user prefers not to install globally).
4. **Configure MCP**: Add the Pinpoint server to the user's MCP configuration JSON, per the snippet above.
5. **Ask if they run their agent in a terminal** (OpenCode, Antigravity CLI, Claude Code, Codex, aider, etc.). If so, offer to install `pinpoint-launcher` too (`npm install -g pinpoint-launcher`) and tell them to start their agent via `pinpoint-launch <their normal agent command>` from now on for automatic, instant triggering. If they're on a GUI-only client, skip this and tell them the two-step "click Send Batch, then ask me to check" flow still applies.

---

## Demo Project
This repository includes a fully-functional Next.js demo dashboard so you can test the code yourself. It's an npm workspace — `packages/pinpoint-react` and `packages/pinpoint-mcp` are consumed locally, not from the registry.

```bash
npm install
npm run dev
```
Navigate to `http://localhost:3000`, press `Alt+P` to summon the Pinpoint command center, and try editing the dashboard. (`predev`/`prebuild` automatically rebuild `pinpoint-react` first, so the demo always runs against the same compiled output real consumers get.)

To try the full auto-trigger flow, run the launcher wrapping any command (even just `cat`, to see raw injected text echoed back) and POST a test batch:
```bash
node packages/pinpoint-launcher/index.js cat
curl -X POST http://127.0.0.1:31337/payload \
  -H "Content-Type: application/json" \
  -d '{"batch":[{"instruction":"test"}]}'
```
You should see the auto-generated trigger message echoed back shortly after. To exercise the MCP side (the actual `read_pinpoint_payload` tool call), point your MCP client at `node packages/pinpoint-mcp/index.js` — it reads whatever the launcher last wrote to the shared temp file.

## Publishing (maintainer notes)
All three packages are plain npm packages under no scope — `pinpoint-react`, `pinpoint-mcp`, and `pinpoint-launcher`. `pinpoint-react` has a `build` script (tsup) that must run before publish; `prepublishOnly` isn't wired up yet, so run `npm run build --workspace=packages/pinpoint-react` manually before `npm publish` until that's automated. `pinpoint-launcher` has native bindings via `node-pty` — verify `npm install` succeeds cleanly on a fresh checkout across platforms before publishing a new version, since a broken prebuild story there breaks the whole auto-trigger flow.

## License
MIT — see [LICENSE](./LICENSE).
