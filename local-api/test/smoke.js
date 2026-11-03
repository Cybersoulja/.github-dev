#!/usr/bin/env node
/**
 * local-api/test/smoke.js
 *
 * Starts server.js in mock mode, hits each route once, and checks the
 * response shape. No test framework — this project has no build step, so
 * keep validation to something runnable with plain `node`.
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

const PORT = 3099;
const BASE = `http://localhost:${PORT}`;

async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(PORT), USE_MOCKS: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealthy();

    await check("GET /healthz", async () => {
      const res = await fetch(`${BASE}/healthz`);
      assertEqual(res.status, 200, "status");
      const body = await res.json();
      assertEqual(body.mocks, true, "mocks flag");
    });

    await check("GET /api/documents", async () => {
      const res = await fetch(`${BASE}/api/documents`);
      assertEqual(res.status, 200, "status");
      const body = await res.json();
      if (!Array.isArray(body.documents) || body.documents.length === 0) {
        throw new Error("expected non-empty documents array");
      }
    });

    await check("GET /api/blocks", async () => {
      const res = await fetch(`${BASE}/api/blocks`);
      assertEqual(res.status, 200, "status");
      const body = await res.json();
      if (!Array.isArray(body.blocks)) throw new Error("expected blocks array");
    });

    await check("POST /api/blocks", async () => {
      const res = await fetch(`${BASE}/api/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: "mock-doc-1", markdown: "hello" }),
      });
      assertEqual(res.status, 201, "status");
      const body = await res.json();
      assertEqual(body.markdown, "hello", "echoed markdown");
    });

    console.log("\nAll smoke checks passed.");
  } finally {
    server.kill();
  }
}

async function waitForHealthy(retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("server never became healthy");
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`ok   - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
