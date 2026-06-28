// Build-time prerender for /post/<slug> pages.
//
// Why this exists: the blog is a client-side app. When someone shares a post
// link, social unfurlers (Discord, X, Facebook, Slack, iMessage) fetch the raw
// HTML once and DO NOT run JavaScript — so JS-updated <title>/og: tags never
// reach them. This script runs in CI and writes one static HTML file per post
// with the post's title/description baked into the meta tags, so link previews
// work. The file still loads blog.js, which opens the reader for the slug, so
// humans land on the real post.
//
// No npm dependencies: uses Node's global fetch (Node 18+).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://mindhas403.dev";
const JSON_URL =
  "https://raw.githubusercontent.com/blueskychan-dev/blogs/main/blogs.json";
const PREVIEW_IMAGE = SITE + "/favicon.webp";
const SITE_TITLE = "blueskychan_";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Slugs come from a trusted repo, but never let one escape the post/ dir.
function safeSlug(s) {
  return String(s || "").replace(/[^a-zA-Z0-9._-]/g, "-");
}

function slugFor(p) {
  if (p && p.slug) return String(p.slug);
  const base = String((p && p.path) || "").split(/[\\/]/).pop();
  return base.replace(/\.[a-z0-9]+$/i, "");
}

// Build the <head> for a single post, then reuse blog.html's <body> verbatim
// (with root-absolute asset paths) so the page chrome stays in sync.
function headFor(post, slug) {
  const url = `${SITE}/post/${encodeURIComponent(slug)}`;
  const title = `${post.title ? post.title + " · " : ""}${SITE_TITLE}`;
  const desc =
    post.desc ||
    "Notes, CTF write-ups, and random thoughts by blueskychan_.";
  return `<head>
<meta charset="UTF-8"></meta>
<meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"></meta>
<meta name="author" content="Phapoom Saksri (blueskychan_)"></meta>
<meta name="theme-color" content="#d56199"></meta>
<link rel="canonical" href="${esc(url)}"></link>
<link rel="icon" type="image/webp" href="/favicon.webp"></link>
<link rel="apple-touch-icon" href="/favicon.webp"></link>
<meta property="og:type" content="article"></meta>
<meta property="og:site_name" content="blueskychan_"></meta>
<meta property="og:title" content="${esc(post.title || SITE_TITLE)}"></meta>
<meta property="og:description" content="${esc(desc)}"></meta>
<meta property="og:url" content="${esc(url)}"></meta>
<meta property="og:image" content="${esc(PREVIEW_IMAGE)}"></meta>
<meta property="og:image:alt" content="blueskychan_"></meta>
<meta name="twitter:card" content="summary"></meta>
<meta name="twitter:title" content="${esc(post.title || SITE_TITLE)}"></meta>
<meta name="twitter:description" content="${esc(desc)}"></meta>
<meta name="twitter:image" content="${esc(PREVIEW_IMAGE)}"></meta>
<meta name="twitter:creator" content="@blueskychan_"></meta>
<link rel="preconnect" href="https://fonts.googleapis.com"></link>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"></link>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;500;600;700;800&amp;family=Noto+Sans+Thai:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600&amp;display=swap" onload="this.onload=null;this.rel='stylesheet'"></link>
<noscript><link href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;500;600;700;800&amp;family=Noto+Sans+Thai:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600&amp;display=swap" rel="stylesheet"></link></noscript>
<link rel="stylesheet" href="/site-styles.css"></link>
</head>`;
}

async function main() {
  // Pull blog.html's body so the prerendered page matches the live blog chrome.
  const blogHtml = await readFile(join(ROOT, "blog.html"), "utf8");
  const bodyMatch = blogHtml.match(/<body[\s\S]*<\/html>/i);
  if (!bodyMatch) {
    throw new Error("Could not find <body>…</html> in blog.html");
  }
  // Served from /post/<slug>/, so relative refs must become root-absolute.
  const body = bodyMatch[0]
    .replace(/(src|href)="(site-core\.js|blog\.js|site-styles\.css|favicon\.webp)"/g, '$1="/$2"');

  let posts = [];
  try {
    const res = await fetch(JSON_URL + "?_=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    posts = (data && data.blogs) ? data.blogs : [];
  } catch (e) {
    // Don't fail the deploy if the blog feed is unreachable — just skip prerender.
    console.warn("[prerender] Skipping: could not load blogs.json —", e.message);
    return;
  }

  let n = 0;
  for (const post of posts) {
    const slug = safeSlug(slugFor(post));
    if (!slug) continue;
    const html = `<!DOCTYPE html>\n<html lang="en" data-page="blog">\n${headFor(post, slug)}\n${body}\n`;
    const dir = join(ROOT, "post", slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.html"), html, "utf8");
    n++;
  }
  console.log(`[prerender] Wrote ${n} post page(s) under /post/`);
}

main().catch((e) => {
  console.error("[prerender] Failed:", e);
  process.exit(1);
});
