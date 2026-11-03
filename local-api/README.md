# Local Development API & Mock Server (Craft Connect)

A local Express proxy/mock server for the Craft Connect API, plus a stdio
MCP server so Claude Desktop and Cursor can talk to it directly during
local development — without ever being configured with your real
capability token.

```
local-api/
├── server.js        # Express dev server: proxies or mocks /api/documents, /api/blocks
├── mcp-server.js     # Stdio MCP server — connects Claude Desktop / Cursor to server.js
├── mocks/            # Canned fixtures used when USE_MOCKS=true
├── test/smoke.js     # Starts the server in mock mode and checks each route
├── example.env      # Copy to .env and fill in CRAFT_API_URL
└── package.json
```

## Setup

```bash
cd local-api
npm install
cp example.env .env
# edit .env — paste your real Craft Connect capability URL into CRAFT_API_URL
```

## Running the local API server

```bash
npm start        # http://localhost:3000
npm run dev       # same, but restarts on file changes
```

Routes:
- `GET /api/documents` — proxies to `${CRAFT_API_URL}/documents`
- `GET /api/blocks?id=<documentId>` — proxies to `${CRAFT_API_URL}/blocks?id=<documentId>`
- `POST /api/blocks` — proxies to `${CRAFT_API_URL}/blocks`
- `GET /healthz` — reports whether mocks are on and `CRAFT_API_URL` is configured

Set `USE_MOCKS=true` in `.env` to serve the fixtures in `mocks/` instead of
calling the real API — useful for offline development, demos, or before
you have a capability token at all.

Your capability token lives only in `.env` on your machine (gitignored) —
it's never sent to Claude, Cursor, or anywhere outside this local proxy.
This proxy has no authentication of its own, so it also:
- binds to `127.0.0.1` by default (`HOST` in `.env`), not all network interfaces
- allows no cross-origin browser access by default (`ALLOWED_ORIGINS` in `.env`)

### A note on the real Craft Connect API shapes

This repo's sandbox can't reach `connect.craft.do`, so the exact request/
response shapes below are **unverified against the live API docs** —
confirm them yourself at https://connect.craft.do/api-docs/space and adjust
`server.js` / `mcp-server.js` / `mocks/` if they differ:
- `GET /blocks` is assumed to take an `id` query param and return a nested
  block tree (`{ id, type, content: [...] }`), not a flat `blocks` array.
- `POST /blocks` is assumed to target a page via `{ position: { position, pageId }, markdown }`,
  not a top-level `documentId`.
- `GET /documents` is assumed to return `{ items: [...] }`, not `{ documents: [...] }`.

## Connecting Claude Desktop / Cursor via MCP

With `server.js` running, point your assistant's MCP config at
`mcp-server.js`:

```json
{
  "mcpServers": {
    "craft-local-api": {
      "command": "node",
      "args": ["/absolute/path/to/local-api/mcp-server.js"]
    }
  }
}
```

This exposes three tools — `list_documents`, `list_blocks`, `create_block`
— that call your local server over HTTP, so the assistant never needs
direct access to the Craft Connect API or its token.

## Local Proxy Switcher (Craft Connect API Studio)

If you're testing from the Craft Connect API Studio, toggle its Local API
Switcher to route requests through `http://localhost:3000/api` instead of
the real Craft Connect endpoint, so you can debug this local server in
real time.

## Testing

```bash
npm test   # starts server.js in mock mode and checks each route once
```

There's no framework here on purpose — this matches the rest of the repo's
"no build step" convention (see the root `CLAUDE.md`); `test/smoke.js` is
plain, runnable `node`.
