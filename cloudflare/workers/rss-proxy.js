/**
 * Cloudflare Worker: rss-proxy.js
 *
 * Serves the podcast RSS feed at /feed/podcast with:
 *  - Edge caching (KV, 1-hour TTL)
 *  - CORS headers for podcast players
 *  - JSON API endpoint at /api/episodes for the website front-end
 */

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

    return new Response("Not found", { status: 404 });
  },
};

// ─── Serve raw RSS feed ───────────────────────────────────────────────────────
async function serveRssFeed(env) {
  try {
    const cached = await env.RSS_CACHE.get("latest-feed");
    const xml = cached ?? await fetchAndCacheFeed(env);
    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("serveRssFeed error:", err);
    return new Response("Feed temporarily unavailable", { status: 503 });
  }
}

// ─── Serve episodes as JSON array ────────────────────────────────────────────
async function serveEpisodesJson(env) {
  try {
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
  } catch (err) {
    console.error("serveEpisodesJson error:", err);
    return new Response(JSON.stringify({ error: "Episodes temporarily unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ─── Serve only the latest episode ───────────────────────────────────────────
async function serveLatestEpisode(env) {
  try {
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
  } catch (err) {
    console.error("serveLatestEpisode error:", err);
    return new Response(JSON.stringify({ error: "Episode temporarily unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ─── Fetch and cache the RSS feed ─────────────────────────────────────────────
async function fetchAndCacheFeed(env) {
  const feedUrl = env.RSS_FEED_URL ?? "https://beatindablock.com/feed/podcast";
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "BeatinDaBlock-Worker/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch RSS feed: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  await env.RSS_CACHE.put("latest-feed", xml, { expirationTtl: 3600 });
  return xml;
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
