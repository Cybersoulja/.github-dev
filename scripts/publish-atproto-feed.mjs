#!/usr/bin/env node
// scripts/publish-atproto-feed.mjs
//
// Publishes (or updates) the app.bsky.feed.generator record that makes the
// BeatinDaBlock custom feed show up in Bluesky. This is a one-off/occasional
// admin action, not something the Worker does at runtime — run it by hand
// whenever the feed's display name/description changes, or once to publish
// it for the first time.
//
// Requires no npm dependencies (Node 18+ has global fetch) — talks to the
// AT Protocol XRPC endpoints directly.
//
// Usage:
//   BSKY_HANDLE=oneseco.com \
//   BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
//   FEEDGEN_HOSTNAME=beatindablock.com \
//   FEEDGEN_RECORD_NAME=beatindablock-curated \
//   FEEDGEN_DISPLAY_NAME="BeatinDaBlock" \
//   FEEDGEN_DESCRIPTION="Posts from the BeatinDaBlock podcast crew." \
//   node scripts/publish-atproto-feed.mjs
//
// BSKY_APP_PASSWORD must be a Bluesky *app password* (Settings → App
// Passwords in the Bluesky app), never the account's main password.

const PDS_URL = process.env.BSKY_PDS_URL ?? "https://bsky.social";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function createSession(handle, appPassword) {
  const res = await fetch(`${PDS_URL}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  if (!res.ok) {
    throw new Error(`createSession failed: ${res.status} ${res.statusText} — ${await res.text()}`);
  }
  return res.json();
}

async function putFeedGeneratorRecord({ accessJwt, did, rkey, record }) {
  const res = await fetch(`${PDS_URL}/xrpc/com.atproto.repo.putRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessJwt}`,
    },
    body: JSON.stringify({
      repo: did,
      collection: "app.bsky.feed.generator",
      rkey,
      record,
    }),
  });
  if (!res.ok) {
    throw new Error(`putRecord failed: ${res.status} ${res.statusText} — ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const handle = requireEnv("BSKY_HANDLE");
  const appPassword = requireEnv("BSKY_APP_PASSWORD");
  const hostname = requireEnv("FEEDGEN_HOSTNAME");
  const recordName = requireEnv("FEEDGEN_RECORD_NAME");
  const displayName = requireEnv("FEEDGEN_DISPLAY_NAME");
  const description = process.env.FEEDGEN_DESCRIPTION ?? "";

  console.log(`Logging in as ${handle}...`);
  const session = await createSession(handle, appPassword);

  const record = {
    $type: "app.bsky.feed.generator",
    did: `did:web:${hostname}`,
    displayName,
    description,
    createdAt: new Date().toISOString(),
  };

  console.log(`Publishing app.bsky.feed.generator/${recordName} under ${session.did}...`);
  const result = await putFeedGeneratorRecord({
    accessJwt: session.accessJwt,
    did: session.did,
    rkey: recordName,
    record,
  });

  console.log("Published:", result.uri);
  console.log(`Feed URI: at://${session.did}/app.bsky.feed.generator/${recordName}`);
  console.log(`View at: https://bsky.app/profile/${session.did}/feed/${recordName}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
