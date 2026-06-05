/**
 * Cloudflare Worker: rss-proxy.js
 *
 * Serves the podcast RSS feed at /feed/podcast with:
 *  - Edge caching (KV, 1-hour TTL)
 *  - CORS headers for podcast players
 *  - JSON API endpoint at /api/episodes for the website front-end
 */

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/feed/podcast") {
      return serveRssFeed(env);
    }

    if (url.pathname === "/api/episodes") {
      return serveEpisodesJson(env);
    }

    if (url.pathname === "/api/episodes/latest") {
      return serveLatestEpisode(env);
    }

    if (url.pathname === "/api/contact") {
      return handleContact(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

// ─── Serve raw RSS feed ───────────────────────────────────────────────────────
async function serveRssFeed(env) {
  const cached = await env.RSS_CACHE.get("latest-feed");
  const xml = cached ?? await fetchAndCacheFeed(env);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ─── Serve episodes as JSON array ────────────────────────────────────────────
async function serveEpisodesJson(env) {
  const cached = await env.RSS_CACHE.get("latest-feed");
  const xml = cached ?? await fetchAndCacheFeed(env);

  const episodes = parseRssToJson(xml);
  return new Response(JSON.stringify(episodes), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ─── Serve only the latest episode ───────────────────────────────────────────
async function serveLatestEpisode(env) {
  const cached = await env.RSS_CACHE.get("latest-feed");
  const xml = cached ?? await fetchAndCacheFeed(env);

  const episodes = parseRssToJson(xml);
  const latest = episodes[0] ?? null;

  return new Response(JSON.stringify(latest), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ─── Fetch and cache the RSS feed ─────────────────────────────────────────────
async function fetchAndCacheFeed(env) {
  const feedUrl = env.RSS_FEED_URL ?? "https://beatindablock.com/feed/podcast";
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "BeatinDaBlock-Worker/1.0" },
  });
  if (!res.ok) {
    throw new Error(`RSS fetch failed with status ${res.status}`);
  }
  const xml = await res.text();
  await env.RSS_CACHE.put("latest-feed", xml, { expirationTtl: 3600 });
  return xml;
}

async function handleContact(request, env) {
  const allowedOrigin = env.SITE_URL ?? "https://beatindablock.com";
  const requestOrigin = request.headers.get("Origin");
  const accessOrigin = requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;
  const corsHeaders = {
    "Access-Control-Allow-Origin": accessOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...corsHeaders, Allow: "POST, OPTIONS" },
    });
  }

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: "Missing required fields." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (
    name.length > MAX_NAME_LENGTH ||
    email.length > MAX_EMAIL_LENGTH ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return new Response(JSON.stringify({ error: "Input is too long." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!EMAIL_REGEX.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email address." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!env.CONTACT_WEBHOOK_URL) {
    return new Response(JSON.stringify({ error: "Contact endpoint is not configured." }), {
      status: 501,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const webhookRes = await fetch(env.CONTACT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, message }),
  });

  if (!webhookRes.ok) {
    return new Response(JSON.stringify({ error: "Failed to deliver message." }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Basic RSS → JSON parser ──────────────────────────────────────────────────
function parseRssToJson(xml) {
  const episodes = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    episodes.push({
      title:       extractTag(item, "title"),
      description: extractTag(item, "description"),
      pubDate:     extractTag(item, "pubDate"),
      link:        extractTag(item, "link"),
      guid:        extractTag(item, "guid"),
      enclosure:   extractEnclosure(item),
      duration:    extractTag(item, "itunes:duration"),
      image:       extractTag(item, "itunes:image") || extractAttr(item, "itunes:image", "href"),
    });
  }

  return episodes;
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? (m[1] ?? m[2] ?? "").trim() : "";
}

function extractAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, "i"));
  return m ? m[1] : "";
}

function extractEnclosure(item) {
  const m = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*type="([^"]*)"[^>]*length="([^"]*)"/i);
  return m ? { url: m[1], type: m[2], length: m[3] } : null;
}
