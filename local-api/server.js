#!/usr/bin/env node
/**
 * local-api/server.js
 *
 * Local Express development server + mock server for the Craft Connect API.
 *
 * Proxies GET /api/documents, GET /api/blocks, and POST /api/blocks to your
 * real Craft Connect capability URL (CRAFT_API_URL in .env), while keeping
 * the token out of the client entirely — only this local server ever sees
 * it. Set USE_MOCKS=true in .env to serve canned fixtures from mocks/
 * instead, for offline work or demos.
 *
 * Usage:
 *   cp example.env .env   # fill in your real CRAFT_API_URL
 *   npm install
 *   npm start               # http://localhost:3000
 */

const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const CRAFT_API_URL = process.env.CRAFT_API_URL;
const USE_MOCKS = process.env.USE_MOCKS === "true";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/documents", async (req, res) => {
  if (USE_MOCKS) return res.json(loadMock("documents.json"));
  await proxy(req, res, "/documents");
});

app.get("/api/blocks", async (req, res) => {
  if (USE_MOCKS) return res.json(loadMock("blocks.json"));
  await proxy(req, res, "/blocks");
});

app.post("/api/blocks", async (req, res) => {
  if (USE_MOCKS) {
    return res.status(201).json({ ...loadMock("blocks.json").blocks[0], ...req.body, id: `mock-block-${Date.now()}` });
  }
  await proxy(req, res, "/blocks", { method: "POST", body: req.body });
});

app.get("/healthz", (req, res) => {
  res.json({ status: "ok", mocks: USE_MOCKS, craftApiConfigured: Boolean(CRAFT_API_URL) });
});

app.use((req, res) => {
  res.status(404).json({ error: "NotFound", message: `No route for ${req.method} ${req.path}` });
});

async function proxy(req, res, upstreamPath, { method = "GET", body } = {}) {
  if (!CRAFT_API_URL) {
    return res.status(503).json({
      error: "NotConfigured",
      message: "CRAFT_API_URL is not set. Copy example.env to .env and fill it in, or set USE_MOCKS=true.",
    });
  }

  try {
    const url = `${CRAFT_API_URL}${upstreamPath}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;
    const upstreamRes = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await upstreamRes.text();
    res.status(upstreamRes.status);
    res.set("Content-Type", upstreamRes.headers.get("content-type") ?? "application/json");
    res.send(text);
  } catch (err) {
    console.error(`proxy error for ${upstreamPath}:`, err);
    res.status(502).json({ error: "UpstreamUnavailable", message: "Failed to reach the Craft Connect API." });
  }
}

function loadMock(filename) {
  return require(path.join(__dirname, "mocks", filename));
}

app.listen(PORT, () => {
  console.log(`local-api listening on http://localhost:${PORT}`);
  console.log(`mode: ${USE_MOCKS ? "mock" : "proxy"}${USE_MOCKS ? "" : CRAFT_API_URL ? "" : " (CRAFT_API_URL not set!)"}`);
});
