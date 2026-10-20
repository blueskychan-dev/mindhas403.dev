// Switch the site's canonical host in one command.
//
// The site currently lives at v3.mindhas403.dev while it is being finished, and
// moves to mindhas403.dev once the old Next.js site is retired. The host appears
// in ~24 places (4 meta tags x 5 pages, robots.txt, and the prerender script), so
// this rewrites all of them together instead of leaving them to drift.
//
//   node scripts/set-canonical-host.mjs https://mindhas403.dev
//   git diff        # review, then commit
//
// Deliberately NOT run in CI: the canonical host is a decision, and it should be
// visible in git history rather than applied invisibly at deploy time.
//
// It only ever touches these four attributes:
//     <link rel="canonical" href="...">
//     <meta property="og:url" content="...">
//     <meta property="og:image" content="...">
//     <meta name="twitter:image" content="...">
// so content links stay untouched — links.html deliberately links to
// https://mindhas403.dev as the *archived v2 site*, and that must not be rewritten.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["index.html", "blog.html", "history.html", "links.html", "devices.html"];

const target = process.argv[2];
if (!target || !/^https:\/\/[a-z0-9.-]+$/i.test(target) || target.endsWith("/")) {
  console.error("Usage: node scripts/set-canonical-host.mjs https://example.com  (no trailing slash)");
  process.exit(1);
}

// Matches only the four identity attributes above, capturing the origin to replace.
const ATTR = /((?:rel="canonical" href=|property="og:url" content=|property="og:image" content=|name="twitter:image" content=)")(https:\/\/[a-z0-9.-]+)/gi;

let changed = 0;
let from = null;

for (const page of PAGES) {
  const path = join(ROOT, page);
  const src = await readFile(path, "utf8");
  let hits = 0;
  const out = src.replace(ATTR, (m, prefix, origin) => {
    if (origin === target) return m;
    from ??= origin;
    hits++;
    return prefix + target;
  });
  if (hits) {
    await writeFile(path, out, "utf8");
    console.log(`  ${page}: ${hits} tag(s)`);
    changed += hits;
  }
}

// robots.txt advertises the sitemap on the canonical host.
const robotsPath = join(ROOT, "robots.txt");
const robots = await readFile(robotsPath, "utf8");
const robotsOut = robots.replace(/^(Sitemap:\s*)https:\/\/[a-z0-9.-]+/im, `$1${target}`);
if (robotsOut !== robots) {
  await writeFile(robotsPath, robotsOut, "utf8");
  console.log("  robots.txt: Sitemap line");
  changed++;
}

// The prerender script builds post canonicals and sitemap.xml from this constant.
const scriptPath = join(ROOT, "scripts", "prerender-posts.mjs");
const script = await readFile(scriptPath, "utf8");
const scriptOut = script.replace(
  /^const SITE = "https:\/\/[a-z0-9.-]+";$/im,
  `const SITE = "${target}";`
);
if (scriptOut !== script) {
  await writeFile(scriptPath, scriptOut, "utf8");
  console.log("  scripts/prerender-posts.mjs: SITE constant");
  changed++;
}

if (!changed) {
  console.log(`Nothing to do — already on ${target}.`);
} else {
  console.log(`\nSwitched ${from ? from + " -> " : ""}${target} (${changed} change(s)).`);
  console.log("Next: review `git diff`, commit, and re-run the deploy so sitemap.xml regenerates.");
  console.log("Then update the custom domain in GitHub repo Settings > Pages, and submit the new sitemap in Search Console.");
}
