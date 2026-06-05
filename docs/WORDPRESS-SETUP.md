# Phase 4: WordPress Site Design

## Option A — WordPress.com (beatindablock.wordpress.com)

### Setup Steps

1. Log in to https://wordpress.com
2. Site → **Settings** → **General** → update Site Title to "BeatinDaBlock" and tagline
3. Upgrade to **Business plan** to map custom domain `beatindablock.com`
4. **Settings → Domains** → Add domain → `beatindablock.com`
5. In Cloudflare DNS, add a CNAME: `@` → `beatindablock.wordpress.com`

### Recommended Theme

- **Podcast** theme (built-in WordPress.com)
- Or **Neve** or **Astra** (lightweight, customizable)
- Apply brand colors from `CONTENT-INVENTORY.md` once recovered

### Site Structure

| Page | Slug | Content |
|------|------|---------|
| Home | `/` | Hero, latest episode embed, about teaser |
| Episodes | `/episodes/` | Full archive, filterable by year/guest |
| About | `/about/` | Show history, host bios, mission |
| Blog | `/blog/` | Show notes, editorial posts |
| Contact | `/contact/` | Contact form (Jetpack or contact block) |

### Custom Post Type: Episodes

Use the Seriously Simple Podcasting plugin:
- Plugin → **SSP** → Episodes → Add New
- Fields: title, audio file, description, guest, season/episode number, publish date

---

## Option B — Self-Hosted WordPress on Cloudflare Pages (Recommended)

> Full control, no monthly WordPress.com subscription fees, faster performance via Cloudflare CDN.

### Setup Steps

1. **Local dev:** Install Local by Flywheel or XAMPP
2. Install WordPress locally
3. Install theme (see below)
4. Build the site locally, then deploy via:
   - [Cloudflare Pages + WordPress](https://developers.cloudflare.com/pages/framework-guides/deploy-wordpress/) — static export
   - OR use Cloudflare Workers for WordPress (Cloudflare's own WP integration)

### Recommended Plugins

| Plugin | Purpose |
|--------|---------|
| Seriously Simple Podcasting | Episode management, RSS feed |
| Yoast SEO | SEO optimization, sitemap |
| Rank Math | Alternative to Yoast |
| WP Super Cache | Caching (if not on CF Pages) |
| Contact Form 7 | Contact form |
| All-in-One WP Migration | Import/export site |
| Classic Editor | If you prefer classic editing |

### Theme Development

Starter theme files are provided in `wordpress/theme/` in this repo.

The theme uses:
- CSS variables matching the brand palette (from `cloudflare/pages/public/assets/css/style.css`)
- `functions.php` registering the Episodes custom post type
- Templates: `index.php`, `single-episode.php`

---

## WordPress XML Content Import

Once episodes and blog posts are recovered via the Wayback Machine scrape:

1. Format content as a WordPress Extended RSS (WXR) file
2. **Tools → Import → WordPress** → upload the XML
3. Map authors and assign to correct post types

Template for a single episode entry:

```xml
<item>
  <title>Episode Title Here</title>
  <link>https://beatindablock.com/episodes/episode-slug/</link>
  <pubDate>Mon, 15 Jun 2013 12:00:00 +0000</pubDate>
  <dc:creator>beatindablock</dc:creator>
  <category domain="post_tag" nicename="hip-hop">Hip-Hop</category>
  <content:encoded><![CDATA[
    <p>Episode description / show notes here.</p>
    <audio controls src="https://beatindablock.com/audio/ep01.mp3"></audio>
  ]]></content:encoded>
  <wp:post_type>episode</wp:post_type>
  <wp:status>publish</wp:status>
</item>
```

---

## Checklist

- [ ] Theme installed and brand colors applied
- [ ] Seriously Simple Podcasting configured
- [ ] RSS feed verified at `/feed/podcast`
- [ ] Episodes archive populated
- [ ] About page written (bios from content inventory)
- [ ] Contact form tested
- [ ] SEO plugin configured (sitemap submitted to Google Search Console)
- [ ] Custom domain mapped (`beatindablock.com`)
