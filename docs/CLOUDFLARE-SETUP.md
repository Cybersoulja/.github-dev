# Phase 3: Cloudflare Setup Guide

## Prerequisites

- Cloudflare account at https://dash.cloudflare.com
- Domain `beatindablock.com` (registered and pointed to Cloudflare nameservers)
- Node.js 18+ installed locally
- Wrangler CLI: `npm install -g wrangler`

---

## Step 1 — Add Domain to Cloudflare

1. Log in → **Add a Site** → enter `beatindablock.com`
2. Select plan (Free is fine for start)
3. Cloudflare will show you nameservers — update them at your registrar
4. Wait for propagation (5 min – 48 hrs)

---

## Step 2 — SSL/TLS

In Cloudflare dashboard → **SSL/TLS** → set mode to **Full (strict)**

---

## Step 3 — Cloudflare Pages (Static Site)

1. **Dashboard → Pages → Create a project**
2. Connect to GitHub → select `Cybersoulja/.github-dev`
3. Set:
   - **Build command:** *(leave blank — static site)*
   - **Build output directory:** `cloudflare/pages/public`
4. Deploy

Your site will be live at `beatindablock.com` after DNS is configured.

---

## Step 4 — Cloudflare Workers

Deploy the two Workers from this repo:

```bash
# Authenticate
wrangler login

# Deploy redirect + cron Worker
cd cloudflare
wrangler deploy workers/redirect.js --name beatindablock-redirects

# Deploy RSS proxy Worker
wrangler deploy workers/rss-proxy.js --name beatindablock-rss
```

Then add routes in the Cloudflare dashboard:
- `beatindablock.com/*` → `beatindablock-redirects`
- `beatindablock.com/api/*` → `beatindablock-rss`
- `beatindablock.com/feed/*` → `beatindablock-rss`

---

## Step 5 — KV Namespace (RSS Cache)

```bash
# Create KV namespace
wrangler kv namespace create RSS_CACHE

# Copy the id from the output and paste into wrangler.toml
```

---

## Step 6 — D1 Database (Episode Metadata)

```bash
# Create D1 database
wrangler d1 create beatindablock-episodes

# Copy the database_id and paste into wrangler.toml

# Run migrations
wrangler d1 execute beatindablock-episodes --file=cloudflare/db/schema.sql
```

### D1 Schema (`cloudflare/db/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS episodes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  pub_date    TEXT,
  description TEXT,
  audio_url   TEXT,
  duration    TEXT,
  guest       TEXT,
  era         TEXT, -- 'archive' (2012-2016) or 'new'
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_episodes_pub_date ON episodes(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_era ON episodes(era);
```

---

## Step 7 — R2 Bucket (Audio Storage)

```bash
# Create R2 bucket
wrangler r2 bucket create beatindablock-audio
```

Use R2 to store:
- Podcast audio files (MP3/AAC)
- Recovered images from Wayback Machine
- Cover art, logos, press photos

---

## Step 8 — Cloudflare Images

1. Dashboard → **Images** → Enable
2. Upload recovered brand assets (logo, cover art, etc.)
3. Use image delivery URLs in the site templates

---

## Step 9 — Cloudflare Stream (Optional)

For video podcast hosting:
1. Dashboard → **Stream** → Upload videos
2. Embed using the Stream iframe or API

---

## Step 10 — Cloudflare Turnstile (Contact Form)

1. Dashboard → **Turnstile** → **Add Widget**
2. Domain: `beatindablock.com`
3. Copy the **Site Key** → replace `REPLACE_WITH_TURNSTILE_SITE_KEY` in `contact/index.html`
4. Copy the **Secret Key** → add to Worker env var `TURNSTILE_SECRET`

---

## Step 11 — Web Analytics

1. Dashboard → **Web Analytics** → Add site → `beatindablock.com`
2. Copy the beacon token → replace `REPLACE_WITH_CLOUDFLARE_ANALYTICS_TOKEN` in `index.html`

---

## Step 12 — Redirect Rule (WordPress → .com)

1. Dashboard → **Rules** → **Redirect Rules** → Create rule
2. **If:** Hostname equals `beatindablock.wordpress.com`
3. **Then:** Dynamic redirect to `https://beatindablock.com${uri_path}` (301)

*(This also works via the Worker — see `cloudflare/workers/redirect.js`)*

---

## Step 13 — AT Protocol (Bluesky) Feed Generator

Deploys a custom Bluesky feed ("BeatinDaBlock") built from a curated list of
accounts. See `cloudflare/workers/atproto-feed.js` for the full design.

1. Add the curated accounts to D1 (the schema seeds `oneseco.com`; add more with):
   ```bash
   wrangler d1 execute beatindablock-episodes \
     --command="INSERT OR IGNORE INTO feed_accounts (handle) VALUES ('somehandle.bsky.social')"
   ```
2. Confirm `FEEDGEN_HOSTNAME`, `FEEDGEN_PUBLISHER_HANDLE`, `FEEDGEN_RECORD_NAME`,
   `FEEDGEN_DISPLAY_NAME` in `cloudflare/wrangler.toml` are correct for your setup.
3. Deploy the worker with its own 5-minute cron:
   ```bash
   wrangler deploy cloudflare/workers/atproto-feed.js \
     --name beatindablock-atproto-feed --triggers "*/5 * * * *"
   ```
4. Add routes in the dashboard:
   - `beatindablock.com/xrpc/*` → `beatindablock-atproto-feed`
   - `beatindablock.com/.well-known/did.json` → `beatindablock-atproto-feed`
5. Publish the feed generator record once, using a Bluesky *app password*
   (Settings → App Passwords in the Bluesky app — never the main password):
   ```bash
   BSKY_HANDLE=oneseco.com \
   BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
   FEEDGEN_HOSTNAME=beatindablock.com \
   FEEDGEN_RECORD_NAME=beatindablock-curated \
   FEEDGEN_DISPLAY_NAME="BeatinDaBlock" \
   FEEDGEN_DESCRIPTION="Posts from the BeatinDaBlock podcast crew." \
   node scripts/publish-atproto-feed.mjs
   ```
6. Verify: `curl https://beatindablock.com/.well-known/did.json` and
   `curl https://beatindablock.com/xrpc/app.bsky.feed.generator.describeFeedGenerator`
   should both return JSON. The feed then appears in Bluesky search under
   its display name within a few minutes.

---

## Checklist

- [ ] Domain added to Cloudflare
- [ ] SSL set to Full (strict)
- [ ] Pages project created and deployed
- [ ] Workers deployed (redirect + RSS proxy + atproto feed)
- [ ] Routes configured
- [ ] KV namespace created and ID in wrangler.toml
- [ ] D1 database created, ID in wrangler.toml, schema applied
- [ ] R2 bucket created
- [ ] Cloudflare Images enabled
- [ ] Turnstile widget created, site key in contact form
- [ ] Analytics token in index.html
- [ ] WordPress redirect rule created
