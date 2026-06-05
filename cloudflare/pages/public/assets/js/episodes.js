/**
 * episodes.js — Fetches episodes from the Cloudflare Worker RSS API
 * and renders them on the homepage.
 */

const API_BASE = "/api";

document.addEventListener("DOMContentLoaded", () => {
  loadLatestEpisode();
  loadRecentEpisodes();
});

async function fetchEpisodes() {
  const res = await fetch(`${API_BASE}/episodes`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadLatestEpisode() {
  const container = document.getElementById("latest-episode-card");
  if (!container) return;

  try {
    const episodes = await fetchEpisodes();
    const ep = episodes[0];
    if (!ep) { container.innerHTML = "<p>No episodes found.</p>"; return; }
    container.innerHTML = renderEpisodeCard(ep, true);
  } catch (err) {
    container.innerHTML = `<p class="loading">Could not load episode. <a href="/episodes/">Browse all episodes →</a></p>`;
  }
}

async function loadRecentEpisodes() {
  const container = document.getElementById("episodes-grid");
  if (!container) return;

  try {
    const episodes = await fetchEpisodes();
    const recent = episodes.slice(1, 7); // episodes 2–7
    if (!recent.length) { container.innerHTML = "<p>No episodes found.</p>"; return; }
    container.innerHTML = recent.map(ep => renderEpisodeCard(ep)).join("");
  } catch (err) {
    container.innerHTML = `<p class="loading">Could not load episodes. <a href="/episodes/">Browse all episodes →</a></p>`;
  }
}

function renderEpisodeCard(ep, large = false) {
  const title   = escapeHtml(ep.title || "Untitled Episode");
  const date    = ep.pubDate ? new Date(ep.pubDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
  const desc    = escapeHtml(stripHtml(ep.description || "").slice(0, 200));
  const link    = escapeHtml(ep.link || "#");
  const audio   = ep.enclosure?.url ? `<audio controls preload="none" src="${escapeHtml(ep.enclosure.url)}" style="width:100%;margin-top:1rem;"></audio>` : "";
  const dur     = ep.duration ? `<span> · ${escapeHtml(ep.duration)}</span>` : "";

  return `
    <article class="episode-card${large ? " episode-card--large" : ""}">
      <h3 class="episode-card__title"><a href="${link}">${title}</a></h3>
      <p class="episode-card__meta">${date}${dur}</p>
      <p class="episode-card__desc">${desc}…</p>
      ${audio}
      <a class="btn btn--primary" href="${link}" style="margin-top:1rem">Listen →</a>
    </article>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip HTML tags from a string without touching the DOM. */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
