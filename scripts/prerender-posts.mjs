// Build-time prerender for /post/<slug> pages, plus sitemap.xml.
//
// Why this exists: the blog is a client-side app. When someone shares a post
// link, social unfurlers (Discord, X, Facebook, Slack, iMessage) fetch the raw
// HTML once and DO NOT run JavaScript — so JS-updated <title>/og: tags never
// reach them. Search crawlers have the same problem, only worse: a page whose
// body is a "Loading posts…" placeholder has nothing to index.
//
// So this script runs in CI and writes one static HTML file per post with the
// post's title/description/date baked into BOTH the meta tags and the visible
// body. The file still loads blog.js, which opens the reader for the slug, so
// humans land on the real post and the static text is replaced.
//
// It also emits sitemap.xml, since /post/<slug> is only enumerable at build
// time. robots.txt (committed at the repo root) points crawlers at it, and
// llms.txt, a Markdown site map for LLM agents.
//
// No npm dependencies: uses Node's global fetch (Node 18+).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://v3.mindhas403.dev";
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

// Landmarks copied verbatim out of blog.html. Each is asserted below, so a
// future edit to blog.html fails the build loudly instead of silently
// shipping 12 contentless pages again.
const BLOG_H1 =
  '<h1 class="section-title">Blog <span class="tag" id="blogCount">…</span></h1>';
const BLOG_SUB =
  '<p class="section-sub">Notes, write-ups, and random thoughts</p>';
const LOADING_MARKER = '<div class="blog-loading">Loading posts…</div>';

const STATIC_PAGES = ["/", "/links", "/blog", "/history", "/devices"];

// blogs.json dates are MM-DD-YYYY; <time datetime> needs ISO 8601.
function isoDate(s) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(s || ""));
  return m ? `${m[3]}-${m[1]}-${m[2]}` : "";
}

// The crawlable stand-in for the post body. blog.js overwrites #blogList as
// soon as it loads, so humans never see this — but a crawler (or anyone with
// JS off) gets the title, date, tags and summary instead of a spinner.
function articleFor(post) {
  const iso = isoDate(post.date);
  const tags = (post.tags || [])
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join("");
  return (
    '<article class="post-card" id="prerenderedPost">' +
    '<div class="post-meta">' +
    (iso
      ? `<span class="post-date"><time datetime="${esc(iso)}">${esc(post.date)}</time></span>`
      : "") +
    `<span class="post-tags">${tags}</span>` +
    "</div>" +
    `<div class="post-title">${esc(post.title || "")}</div>` +
    (post.desc ? `<div class="post-desc">${esc(post.desc)}</div>` : "") +
    "</article>" +
    '<p style="margin-top:12px"><a href="/blog">← All posts</a></p>'
  );
}

// On a post page the <h1> should be the post, not the word "Blog".
function bodyForPost(body, post) {
  return body
    .replace(BLOG_H1, () => `<h1 class="section-title">${esc(post.title || "")}</h1>`)
    .replace(BLOG_SUB, () =>
      post.desc ? `<p class="section-sub">${esc(post.desc)}</p>` : BLOG_SUB)
    .replace(LOADING_MARKER, () => articleFor(post));
}

// llms.txt — a plain-Markdown map of the site for LLM agents that look for one.
// No vendor has committed to consuming this; it is cheap and truthful, so it
// ships, but do not expect it to move anything on its own. Generated (not
// committed) so the post list cannot drift out of date.
function writeLlmsTxt(entries) {
  const lines = [
    "# blueskychan_ — Phapoom Saksri (ผาภูมิ ศักดิ์ศรี)",
    "",
    "> Personal site of Phapoom Saksri (ผาภูมิ ศักดิ์ศรี), known online as blueskychan_ " +
      "and mindhas403. Student developer in Nonthaburi, Thailand, working on cybersecurity, " +
      "CTFs, reverse engineering, Linux and C#/C++.",
    "",
    "## Pages",
    "",
    `- [About](${SITE}/): profile, skills, education, and certificates from CTF competitions and security courses`,
    `- [Links](${SITE}/links): profiles on GitHub, Mastodon, osu!, OpenStreetMap and elsewhere`,
    `- [Devices](${SITE}/devices): full hardware specifications for every machine in daily use`,
    `- [Blog](${SITE}/blog): notes, CTF write-ups, and personal posts`,
    `- [History](${SITE}/history): longer background — currently a placeholder`,
    "",
  ];
  if (entries.length) {
    lines.push("## Posts", "");
    for (const { slug, post } of entries) {
      const desc = String(post.desc || "").replace(/\s+/g, " ").trim();
      lines.push(`- [${post.title || slug}](${SITE}/post/${slug})${desc ? ": " + desc : ""}`);
    }
    lines.push("");
  }
  return writeFile(join(ROOT, "llms.txt"), lines.join("\n"), "utf8");
}

function writeSitemap(slugs) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = STATIC_PAGES.concat(slugs.map((s) => `/post/${s}`));
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`)
      .join("\n") +
    "\n</urlset>\n";
  return writeFile(join(ROOT, "sitemap.xml"), xml, "utf8");
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

  for (const [name, marker] of [
    ["BLOG_H1", BLOG_H1],
    ["BLOG_SUB", BLOG_SUB],
    ["LOADING_MARKER", LOADING_MARKER],
  ]) {
    if (!body.includes(marker)) {
      throw new Error(
        `prerender: ${name} no longer matches blog.html — update it in this script`
      );
    }
  }

  let posts = [];
  let feedOk = true;
  try {
    const res = await fetch(JSON_URL + "?_=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    posts = (data && data.blogs) ? data.blogs : [];
  } catch (e) {
    // Don't fail the deploy if the blog feed is unreachable — skip the post
    // pages, but still emit a sitemap for the five static pages.
    console.warn("[prerender] Skipping post pages: could not load blogs.json —", e.message);
    feedOk = false;
  }

  const entries = [];
  if (feedOk) {
    for (const post of posts) {
      const slug = safeSlug(slugFor(post));
      if (!slug) continue;
      const html = `<!DOCTYPE html>\n<html lang="en" data-page="blog">\n${headFor(post, slug)}\n${bodyForPost(body, post)}\n`;
      const dir = join(ROOT, "post", slug);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "index.html"), html, "utf8");
      entries.push({ slug, post });
    }
  }

  const slugs = entries.map((e) => e.slug);
  await writeSitemap(slugs);
  await writeLlmsTxt(entries);
  console.log(
    `[prerender] Wrote ${slugs.length} post page(s) under /post/, sitemap.xml with ${STATIC_PAGES.length + slugs.length} URL(s), and llms.txt`
  );
}

main().catch((e) => {
  console.error("[prerender] Failed:", e);
  process.exit(1);
});
