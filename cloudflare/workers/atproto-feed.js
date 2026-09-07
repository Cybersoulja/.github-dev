/**
 * Cloudflare Worker: atproto-feed.js
 *
 * A Bluesky (AT Protocol) custom feed generator for BeatinDaBlock.
 *
 * Algorithm: curated account list. Every few minutes (cron), this Worker
 * fetches recent posts from each handle in the D1 `feed_accounts` table via
 * Bluesky's public AppView API and stores them in `feed_posts`. On request,
 * it serves those posts back through the two XRPC endpoints the AT Protocol
 * requires, plus the did:web document that ties this Worker to the feed
 * generator record published under FEEDGEN_PUBLISHER_HANDLE's account.
 *
 * Required env vars (see cloudflare/wrangler.toml):
 *   FEEDGEN_HOSTNAME          — hostname this Worker is routed on (did:web id), e.g. "beatindablock.com"
 *   FEEDGEN_PUBLISHER_HANDLE  — Bluesky handle that owns the feed generator record, e.g. "oneseco.com"
 *   FEEDGEN_RECORD_NAME       — rkey of the app.bsky.feed.generator record, e.g. "beatindablock-curated"
 *   FEEDGEN_DISPLAY_NAME      — display name shown in the Bluesky app
 * Bindings: DB (D1), RSS_CACHE (KV — reused here to cache the resolved publisher DID)
 *
 * Routes (add in the Cloudflare dashboard, more specific than the redirect
 * Worker's beatindablock.com/* catch-all):
 *   beatindablock.com/xrpc/*             → beatindablock-atproto-feed
 *   beatindablock.com/.well-known/did.json → beatindablock-atproto-feed
 *
 * Deploy with its own cron (separate from the shared hourly RSS cache cron —
 * pass --triggers explicitly so it doesn't get overwritten by wrangler.toml's
 * [triggers] block, which the redirect Worker also deploys under). See
 * cloudflare/README.md for the exact deploy command (a 5-minute cron).
 */

const PUBLIC_API = "https://public.api.bsky.app";
const POSTS_PER_ACCOUNT = 50;
const MAX_SKELETON_LIMIT = 100;
const POST_RETENTION_DAYS = 90;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/.well-known/did.json") {
      return serveDidDocument(env);
    }

    if (url.pathname === "/xrpc/app.bsky.feed.generator.describeFeedGenerator") {
      return describeFeedGenerator(env);
    }

    if (url.pathname === "/xrpc/app.bsky.feed.generator.getFeedSkeleton") {
      return getFeedSkeleton(url, env);
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(indexCuratedAccounts(env));
  },
};

// ─── did:web document ──────────────────────────────────────────────────────
function serveDidDocument(env) {
  const hostname = env.FEEDGEN_HOSTNAME;
  const doc = {
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: `did:web:${hostname}`,
    service: [
      {
        id: "#bsky_fg",
        type: "BskyFeedGenerator",
        serviceEndpoint: `https://${hostname}`,
      },
    ],
  };
  return json(doc);
}

// ─── describeFeedGenerator ──────────────────────────────────────────────────
async function describeFeedGenerator(env) {
  try {
    const did = `did:web:${env.FEEDGEN_HOSTNAME}`;
    const publisherDid = await resolvePublisherDid(env);
    return json({
      did,
      feeds: [{ uri: feedUri(publisherDid, env) }],
    });
  } catch (err) {
    console.error("describeFeedGenerator error:", err);
    return json({ error: "InternalServerError", message: "Feed temporarily unavailable" }, 503);
  }
}

// ─── getFeedSkeleton ─────────────────────────────────────────────────────────
async function getFeedSkeleton(url, env) {
  try {
    const feedParam = url.searchParams.get("feed");
    const publisherDid = await resolvePublisherDid(env);
    const expectedUri = feedUri(publisherDid, env);
    if (feedParam !== expectedUri) {
      return json({ error: "UnknownFeed", message: `Unknown feed: ${feedParam}` }, 400);
    }

    const limit = clampLimit(url.searchParams.get("limit"));
    const cursor = url.searchParams.get("cursor");

    let rows;
    if (cursor) {
      const [indexedAt, cursorUri] = cursor.split("::");
      rows = await env.DB.prepare(
        `SELECT uri, indexed_at FROM feed_posts
         WHERE indexed_at < ?1 OR (indexed_at = ?1 AND uri < ?2)
         ORDER BY indexed_at DESC, uri DESC
         LIMIT ?3`
      ).bind(indexedAt, cursorUri, limit).all();
    } else {
      rows = await env.DB.prepare(
        `SELECT uri, indexed_at FROM feed_posts
         ORDER BY indexed_at DESC, uri DESC
         LIMIT ?1`
      ).bind(limit).all();
    }

    const results = rows.results ?? [];
    const feed = results.map((row) => ({ post: row.uri }));
    const last = results[results.length - 1];
    const nextCursor = last ? `${last.indexed_at}::${last.uri}` : undefined;

    return json({ cursor: nextCursor, feed });
  } catch (err) {
    console.error("getFeedSkeleton error:", err);
    return json({ error: "InternalServerError", message: "Feed temporarily unavailable" }, 503);
  }
}

function clampLimit(rawLimit) {
  const parsed = parseInt(rawLimit ?? "50", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, MAX_SKELETON_LIMIT);
}

function feedUri(publisherDid, env) {
  return `at://${publisherDid}/app.bsky.feed.generator/${env.FEEDGEN_RECORD_NAME}`;
}

// ─── Resolve + cache the publisher's DID ────────────────────────────────────
async function resolvePublisherDid(env) {
  const cacheKey = "feedgen-publisher-did";
  const cached = await env.RSS_CACHE.get(cacheKey);
  if (cached) return cached;

  const did = await resolveHandle(env.FEEDGEN_PUBLISHER_HANDLE);
  await env.RSS_CACHE.put(cacheKey, did, { expirationTtl: 86400 });
  return did;
}

async function resolveHandle(handle) {
  const res = await fetch(
    `${PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
    { headers: { "User-Agent": "BeatinDaBlock-Worker/1.0" } }
  );
  if (!res.ok) {
    throw new Error(`Failed to resolve handle ${handle}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.did;
}

// ─── Cron: index posts from curated accounts ────────────────────────────────
async function indexCuratedAccounts(env) {
  try {
    const accounts = await env.DB.prepare(
      `SELECT handle, did FROM feed_accounts`
    ).all();

    for (const account of accounts.results ?? []) {
      try {
        // Re-resolve on every run (not just when did is unset) so a handle
        // that changes ownership or moves to a different DID doesn't leave
        // the feed indexing the old account indefinitely.
        const did = await resolveHandle(account.handle);
        if (did !== account.did) {
          await env.DB.prepare(
            `UPDATE feed_accounts SET did = ?1 WHERE handle = ?2`
          ).bind(did, account.handle).run();
        }
        await indexAuthorFeed(env, did);
      } catch (err) {
        console.error(`indexCuratedAccounts error for ${account.handle}:`, err);
      }
    }

    await pruneOldPosts(env);
  } catch (err) {
    console.error("indexCuratedAccounts error:", err);
  }
}

async function indexAuthorFeed(env, did) {
  const res = await fetch(
    `${PUBLIC_API}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(did)}` +
      `&limit=${POSTS_PER_ACCOUNT}&filter=posts_no_replies`,
    { headers: { "User-Agent": "BeatinDaBlock-Worker/1.0" } }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch author feed for ${did}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  const statements = [];
  for (const item of data.feed ?? []) {
    // Skip reposts — only index the account's own original posts.
    if (item.reason) continue;
    const post = item.post;
    if (!post?.uri || !post?.cid || post.author?.did !== did) continue;
    const createdAt = post.record?.createdAt ?? post.indexedAt;
    if (!createdAt) continue;

    statements.push(
      env.DB.prepare(
        `INSERT INTO feed_posts (uri, cid, author_did, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(uri) DO NOTHING`
      ).bind(post.uri, post.cid, did, createdAt)
    );
  }

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }
}

async function pruneOldPosts(env) {
  await env.DB.prepare(
    `DELETE FROM feed_posts WHERE indexed_at < datetime('now', ?1)`
  ).bind(`-${POST_RETENTION_DAYS} days`).run();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
