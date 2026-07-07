#!/usr/bin/env node

// pinpoint-launch — wraps ANY terminal-based coding agent (opencode, agy,
// claude, codex, aider, etc.) in a pty, so Pinpoint can inject a synthetic
// "check for new instructions" message directly into the agent's input the
// instant a batch arrives from the browser — no more manually typing
// "I sent a batch" yourself.
//
// Why this has to live here instead of in pinpoint-mcp: the MCP server is a
// separate child process the agent spawns over stdio purely for JSON-RPC
// tool calls. It has no access to the terminal the human is actually typing
// into, so it can never "type" into the agent's TUI. This launcher process
// IS that terminal (it pty-wraps the agent), so it can.
//
// Usage:
//   pinpoint-launch agy
//   pinpoint-launch opencode
//   pinpoint-launch -- claude --model sonnet
//   pinpoint-launch --port 31337 --trigger "Check pinpoint" -- aider

const os = require('os');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

let pty;
try {
  pty = require('node-pty');
} catch (err) {
  console.error(
    '[pinpoint-launch] Missing dependency "node-pty". This package uses ' +
    'native bindings, so if a prebuilt binary isn\'t available for your ' +
    'platform/Node version, npm needs to compile it — install build tools ' +
    'first: Xcode Command Line Tools (macOS), build-essential + python3 ' +
    '(Linux), or Visual Studio Build Tools (Windows), then reinstall.\n' +
    'Original error: ' + err.message
  );
  process.exit(1);
}

const PAYLOAD_FILE = path.join(os.tmpdir(), 'pinpoint-mcp-latest-payload.json');

// Last-resort safety net: node-pty's spawn failure mode varies (some
// versions throw synchronously, others surface it as an async 'error'
// event on the underlying child process) — this ensures either way the
// person sees one clean line instead of a raw stack trace.
process.on('uncaughtException', (err) => {
  console.error(`[pinpoint-launch] Fatal error: ${err.message}`);
  if (err.code === 'ENOENT') {
    console.error('[pinpoint-launch] Check that the command is installed and on your PATH.');
  }
  process.exit(1);
});

const HELP = `pinpoint-launch — run your AI coding agent so Pinpoint batches trigger it instantly

Usage:
  pinpoint-launch <agent command> [args...]
  pinpoint-launch -- <agent command> [args...]

Examples:
  pinpoint-launch agy
  pinpoint-launch opencode
  pinpoint-launch claude
  pinpoint-launch codex
  pinpoint-launch -- aider --model sonnet

Options:
  --port <n>          HTTP port to receive batches on (default: 31337)
  --trigger <text>     Fixed message to inject instead of the auto-generated one
  --quiet-ms <n>       How long the agent must be silent before injecting (default: 600)
  --max-wait-ms <n>    Inject anyway after this long, even if not quiet (default: 5000)
  --help, -h           Show this help
`;

function parseArgs(argv) {
  const opts = { port: 31337, trigger: null, quietMs: 600, maxWaitMs: 5000, command: [], help: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') { rest.push(...argv.slice(i + 1)); break; }
    if (arg === '--port') { opts.port = Number(argv[++i]); continue; }
    if (arg === '--trigger') { opts.trigger = argv[++i]; continue; }
    if (arg === '--quiet-ms') { opts.quietMs = Number(argv[++i]); continue; }
    if (arg === '--max-wait-ms') { opts.maxWaitMs = Number(argv[++i]); continue; }
    if (arg === '--help' || arg === '-h') { opts.help = true; continue; }
    rest.push(arg);
  }
  opts.command = rest;
  return opts;
}

function buildTriggerMessage(trigger, batch) {
  if (trigger) return trigger;
  const count = Array.isArray(batch) ? batch.length : 0;
  const plural = count === 1 ? 'instruction' : 'instructions';
  return `Pinpoint sent ${count} new ${plural} — call read_pinpoint_payload and apply them.`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help || !opts.command.length) {
    console.log(HELP);
    process.exit(opts.help ? 0 : 1);
  }

  const [cmd, ...cmdArgs] = opts.command;

  let shell;
  try {
    shell = pty.spawn(cmd, cmdArgs, {
      name: 'xterm-256color',
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
      cwd: process.cwd(),
      env: process.env,
      useShell: process.platform === \'win32\',
      useShell: process.platform === 'win32'
    });
  } catch (err) {
    console.error(`[pinpoint-launch] Couldn't start "${cmd}": ${err.message}`);
    console.error(`[pinpoint-launch] Check that "${cmd}" is installed and on your PATH.`);
    process.exit(1);
  }

  console.error(
    `[pinpoint-launch] Wrapping "${[cmd, ...cmdArgs].join(' ')}" — ` +
    `listening for Pinpoint batches on http://127.0.0.1:${opts.port}/payload`
  );

  // --- Transparent passthrough: the human still interacts exactly as before ---
  let lastOutputTime = Date.now();
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (data) => shell.write(data.toString()));
  shell.onData((data) => {
    lastOutputTime = Date.now();
    process.stdout.write(data);
  });

  process.stdout.on('resize', () => {
    try {
      shell.resize(process.stdout.columns, process.stdout.rows);
    } catch {
      // Ignore resize races against process teardown.
    }
  });

  const restoreAndExit = (code) => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.exit(code);
  };
  shell.onExit(({ exitCode }) => restoreAndExit(exitCode ?? 0));
  process.on('SIGINT', () => shell.write('\x03'));
  process.on('SIGTERM', () => shell.kill());

  // Injects only once the wrapped agent has been quiet for `quietMs` —
  // avoids shoving text into the middle of an in-progress response — but
  // never waits longer than `maxWaitMs`, so a busy/animated TUI can't
  // delay delivery indefinitely.
  function scheduleInjection(message) {
    const start = Date.now();
    (function tryInject() {
      const idleFor = Date.now() - lastOutputTime;
      const waitedFor = Date.now() - start;
      if (idleFor >= opts.quietMs || waitedFor >= opts.maxWaitMs) {
        shell.write(message + '\r');
        return;
      }
      setTimeout(tryInject, 150);
    })();
  }

  // --- Payload receiver: same endpoint the browser already POSTs to ---
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Debounce: if several "Send Batch" clicks land within this window,
  // coalesce them into a single injected message instead of spamming the
  // agent's input with one line per click.
  const DEBOUNCE_MS = 400;
  let pendingBatch = null;
  let debounceTimer = null;

  app.post('/payload', (req, res) => {
    const batch = req.body?.batch || [];
    if (!batch.length) {
      return res.status(400).json({ success: false, error: 'Empty batch' });
    }

    pendingBatch = batch;
    try {
      fs.writeFileSync(PAYLOAD_FILE, JSON.stringify(batch, null, 2));
    } catch (err) {
      console.error(`[pinpoint-launch] Could not write payload file: ${err.message}`);
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const message = buildTriggerMessage(opts.trigger, pendingBatch);
      scheduleInjection(message);
      pendingBatch = null;
      debounceTimer = null;
    }, DEBOUNCE_MS);

    res.json({ success: true, injected: true });
  });

  app.use((err, _req, res, _next) => {
    console.error(`[pinpoint-launch] Bad request: ${err.message}`);
    res.status(400).json({ success: false, error: 'Invalid request body' });
  });

  const httpServer = app.listen(opts.port, '127.0.0.1', () => {
    // Deliberately quiet on success — the startup line above already covers it.
  });
  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[pinpoint-launch] Port ${opts.port} is already in use — another ` +
        `pinpoint-launch instance may still be running. Stop it, or pass ` +
        `--port to use a different one (update the Pinpoint browser ` +
        `client's port too if you do).`
      );
    } else {
      console.error(`[pinpoint-launch] HTTP server failed to start: ${err.message}`);
    }
  });
}

main();
