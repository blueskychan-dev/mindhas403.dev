(function () {
  var listEl = document.getElementById("blogList");
  if (!listEl) { return; }
  var searchWrap = document.getElementById("blogSearch");
  var searchInput = document.getElementById("blogSearchInput");
  var langFilters = document.getElementById("blogLangFilters");
  var allPosts = [];
  var groupedPosts = [];
  var pairBySlug = {};
  var activeLang = "all";

  var IS_LOCAL = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/i.test(location.hostname);
  var JSON_URL = IS_LOCAL ? "/_local_blogs/blogs.json" : "https://raw.githubusercontent.com/blueskychan-dev/blogs/main/blogs.json";
  var RAW_BASE = IS_LOCAL ? "/_local_blogs/" : "https://raw.githubusercontent.com/blueskychan-dev/blogs/main/";
  var ASSET_BASE = IS_LOCAL ? "/_local_blogs/public" : "https://raw.githubusercontent.com/blueskychan-dev/blogs/main/public"; // post images live under /public
  var REPO_BASE = "https://github.com/blueskychan-dev/blogs/blob/main/";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Comments run on Giscus (GitHub Discussions). Each post maps to a discussion
  // titled "post/<slug>" in the repo below — the same pathname scheme the old
  // Utterances setup used; those issue threads were converted to discussions, so
  // existing comments (e.g. post/mccooked, post/augupdate) are reused as-is.
  // strict=1 matches on a sha1 of the term (stored in the discussion body) so
  // "post/mccooked" can't accidentally pick up "post/mccooked-th".
  var GISCUS_ORIGIN = "https://giscus.app";
  var GISCUS = {
    repo: "blueskychan-dev/mindhas403.dev",
    repoId: "R_kgDOS7fcHA",
    category: "Announcements",
    categoryId: "DIC_kwDOS7fcHM4DJMIy"
  };

  function esc(t) {
    var d = document.createElement("div");
    d.textContent = t == null ? "" : String(t);
    return d.innerHTML;
  }
  function fmtDate(s) {
    var p = String(s || "").split("-"); // MM-DD-YYYY
    if (p.length !== 3) { return s || ""; }
    var m = parseInt(p[0], 10), d = parseInt(p[1], 10), y = parseInt(p[2], 10);
    if (!m || !d || !y || m < 1 || m > 12) { return s; }
    return MONTHS[m - 1] + " " + d + ", " + y;
  }
  function ts(s) {
    var p = String(s || "").split("-");
    var t = new Date(parseInt(p[2], 10), parseInt(p[0], 10) - 1, parseInt(p[1], 10)).getTime();
    return isNaN(t) ? 0 : t;
  }

  // ---------- Slug + URL routing ----------
  // Each post is reachable at /post/<slug> (pretty path on the live site) so it can
  // be shared, refreshed, and navigated with the browser back/forward buttons.
  var bySlug = {};
  var SITE_TITLE = "blueskychan_";

  function slugFor(p) {
    if (p && p.slug) { return String(p.slug); }
    var base = String((p && p.path) || "").split(/[\\/]/).pop();
    return base.replace(/\.[a-z0-9]+$/i, "");
  }
  function detectLang(p) {
    if (p && (p.lang === "th" || p.lang === "en")) { return p.lang; }
    var s = slugFor(p);
    if (/-th$/i.test(s)) { return "th"; }
    if (/[\u0E00-\u0E7F]/.test((p && p.title || "") + " " + (p && p.desc || ""))) { return "th"; }
    return "en";
  }
  function baseSlugFor(slug) {
    return String(slug || "").replace(/-th$/i, "");
  }
  function buildPairs(posts) {
    pairBySlug = {};
    var groups = [];
    var seen = {};
    posts.forEach(function (p) {
      var s = slugFor(p);
      if (seen[s]) { return; }
      var base = baseSlugFor(s);
      var enPost = bySlug[base];
      var thPost = bySlug[base + "-th"];
      if (enPost && thPost && base !== base + "-th") {
        seen[base] = true;
        seen[base + "-th"] = true;
        var pair = { baseSlug: base, en: enPost, th: thPost, primary: enPost };
        pairBySlug[base] = pair;
        pairBySlug[base + "-th"] = pair;
        groups.push(pair);
      } else {
        seen[s] = true;
        var lang = detectLang(p);
        var single = { baseSlug: s, en: lang === "en" ? p : null, th: lang === "th" ? p : null, primary: p };
        pairBySlug[s] = single;
        groups.push(single);
      }
    });
    return groups;
  }
  // In the editor/preview the page is served as a file (…/blog.html), where pretty
  // paths can't resolve on reload — fall back to a ?post= query there. On the live
  // site (…/blog) we use the clean /post/<slug> path the user asked for.
  function isFileMode() { return /\.html?$/i.test(location.pathname); }
  function urlForSlug(slug) {
    if (isFileMode()) { return location.pathname + "?post=" + encodeURIComponent(slug); }
    return "/post/" + encodeURIComponent(slug);
  }
  function listUrl() {
    if (isFileMode()) { return location.pathname; }
    return "/blog";
  }
  function slugFromUrl() {
    var m = location.pathname.match(/\/post\/([^\/?#]+)/);
    if (m) { return decodeURIComponent(m[1]); }
    try {
      var q = new URLSearchParams(location.search).get("post");
      if (q) { return q; }
    } catch (e) {}
    var hm = location.hash.match(/^#\/?post\/([^\/?#]+)/);
    if (hm) { return decodeURIComponent(hm[1]); }
    return null;
  }
  function pushUrl(url) {
    try { history.pushState({}, "", url); } catch (e) {}
  }
  function route() {
    var slug = slugFromUrl();
    var post = slug ? bySlug[slug] : null;
    if (post) { openReader(post, false); }
    else { closeReader(false); }
  }

  fetch(JSON_URL + "?_=" + Date.now(), { cache: "no-store" })
    .then(function (r) { if (!r.ok) { throw new Error("HTTP " + r.status); } return r.json(); })
    .then(function (data) {
      var posts = (data && data.blogs) ? data.blogs.slice() : [];
      posts.sort(function (a, b) { return ts(b.date) - ts(a.date); });
      var countEl = document.getElementById("blogCount");
      bySlug = {};
      posts.forEach(function (p) { bySlug[slugFor(p)] = p; });
      allPosts = posts;
      groupedPosts = buildPairs(posts);
      if (countEl) { countEl.textContent = groupedPosts.length; }
      if (searchWrap && posts.length) { searchWrap.hidden = false; }
      if (langFilters && posts.length) { langFilters.hidden = false; }
      applyFilter(); // render, honoring any text already typed into the search box
      route(); // honor a deep link on first load (/post/<slug> or ?post=<slug>)
    })
    .catch(function () {
      var countEl = document.getElementById("blogCount");
      if (countEl) { countEl.textContent = "0"; }
      listEl.innerHTML =
        '<div class="empty-state"><div class="es-emoji">📡</div>' +
        '<div class="es-title">Couldn\u2019t load posts</div>' +
        '<div class="es-sub">The blog feed didn\u2019t load. You can browse posts directly on ' +
        '<a href="https://github.com/blueskychan-dev/blogs" target="_blank" rel="noopener">GitHub</a> instead.</div></div>';
    });

  // ---------- Search / filter ----------
  // Posts are filtered in-memory; bySlug still holds every post so deep links keep working.
  function postMatches(p, terms) {
    if (!p) { return false; }
    var hay = [p.title, p.desc].concat(p.tags || []).join(" ").toLowerCase();
    return terms.every(function (t) { return hay.indexOf(t) !== -1; });
  }
  function groupMatches(g, terms) {
    if (activeLang === "en" && !g.en) { return false; }
    if (activeLang === "th" && !g.th) { return false; }
    if (!terms.length) { return true; }
    return postMatches(g.en, terms) || postMatches(g.th, terms);
  }
  function applyFilter() {
    var q = (searchInput && searchInput.value || "").trim().toLowerCase();
    var terms = q ? q.split(/\s+/) : [];
    var filtered = groupedPosts.filter(function (g) { return groupMatches(g, terms); });
    var countEl = document.getElementById("blogCount");
    if (countEl) { countEl.textContent = filtered.length; }
    render(filtered, q);
  }
  if (searchInput) { searchInput.addEventListener("input", applyFilter); }
  if (langFilters) {
    langFilters.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-lang]");
      if (!btn) { return; }
      activeLang = btn.getAttribute("data-lang") || "all";
      langFilters.querySelectorAll("button[data-lang]").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
      applyFilter();
    });
  }

  function render(groups, query) {
    if (!groups.length) {
      if (query || activeLang !== "all") {
        listEl.innerHTML =
          '<div class="empty-state"><div class="es-emoji">\ud83d\udd0d</div>' +
          '<div class="es-title">No matching posts</div>' +
          '<div class="es-sub">' + (query ? 'Nothing matched \u201c' + esc(query) + '\u201d. Try a different word or tag.' : 'No posts in this language yet.') + '</div></div>';
      } else {
        listEl.innerHTML =
          '<div class="empty-state"><div class="es-emoji">\u270d\ufe0f</div>' +
          '<div class="es-title">No posts yet</div>' +
          '<div class="es-sub">First posts are coming soon. Check back later!</div></div>';
      }
      return;
    }
    listEl.innerHTML = groups.map(function (g) {
      var p = (activeLang === "th" && g.th) ? g.th : (g.en || g.th);
      var langBadge = (g.en && g.th)
        ? '<span class="tag lang-badge bilingual" title="Available in English and Thai">EN \u00b7 TH</span>'
        : (g.th
          ? '<span class="tag lang-badge th" title="Thai">TH</span>'
          : '<span class="tag lang-badge en" title="English">EN</span>');
      var altTitle = (g.en && g.th)
        ? (p === g.en ? "\ud83c\uddf9\ud83c\udded " + g.th.title : "\ud83c\uddec\ud83c\udde7 " + g.en.title)
        : "";
      var tags = (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
      return '<a class="post-card" href="' + esc(urlForSlug(slugFor(p))) + '" data-slug="' + esc(slugFor(p)) + '" data-path="' + esc(p.path) + '" data-title="' + esc(p.title) + '">' +
        '<div class="post-meta"><span class="post-date">' + esc(fmtDate(p.date)) + "</span>" +
        langBadge +
        '<span class="post-tags">' + tags + "</span></div>" +
        '<div class="post-title">' + esc(p.title) + "</div>" +
        (altTitle ? '<div class="post-alt-title">' + esc(altTitle) + "</div>" : "") +
        (p.desc ? '<div class="post-desc">' + esc(p.desc) + "</div>" : "") +
        "</a>";
    }).join("");
  }

  // ---------- Reader ----------
  var reader = document.getElementById("blogReader");
  var rTitle = document.getElementById("brTitle");
  var rLangs = document.getElementById("brLangs");
  var rBody = document.getElementById("brBody");
  var rGit = document.getElementById("brGithub");

  function renderReaderLangs(slug) {
    if (!rLangs) { return; }
    var pair = pairBySlug[slug];
    if (!pair || !pair.en || !pair.th) {
      rLangs.hidden = true;
      rLangs.innerHTML = "";
      return;
    }
    var enSlug = slugFor(pair.en);
    var thSlug = slugFor(pair.th);
    var isTh = (slug === thSlug);
    rLangs.innerHTML =
      '<a class="br-lang' + (!isTh ? " active" : "") + '" href="' + esc(urlForSlug(enSlug)) + '" data-slug="' + esc(enSlug) + '" title="Read in English">EN</a>' +
      '<a class="br-lang' + (isTh ? " active" : "") + '" href="' + esc(urlForSlug(thSlug)) + '" data-slug="' + esc(thSlug) + '" title="อ่านภาษาไทย">TH</a>';
    rLangs.hidden = false;
  }
  if (rLangs) {
    rLangs.addEventListener("click", function (e) {
      var btn = e.target.closest("a[data-slug]");
      if (!btn) { return; }
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) { return; }
      e.preventDefault();
      var target = bySlug[btn.getAttribute("data-slug")];
      if (target) { openReader(target, true); }
    });
  }

  // ---------- Comments ----------
  function giscusTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }
  function loadComments(slug, host) {
    if (!host) { return; }
    host.innerHTML = "";
    var attrs = {
      "data-repo": GISCUS.repo,
      "data-repo-id": GISCUS.repoId,
      "data-category": GISCUS.category,
      "data-category-id": GISCUS.categoryId,
      "data-mapping": "specific",
      "data-term": "post/" + slug,
      "data-strict": "1",
      "data-reactions-enabled": "1",
      "data-emit-metadata": "0",
      "data-input-position": "bottom",
      "data-theme": giscusTheme(),
      "data-lang": "en",
      "data-loading": "lazy"
    };
    var s = document.createElement("script");
    s.src = GISCUS_ORIGIN + "/client.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    host.appendChild(s);
  }
  // Keep the widget's theme in sync with the site's dark-mode toggle (data-theme on <html>).
  new MutationObserver(function () {
    var frame = document.querySelector("iframe.giscus-frame");
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ giscus: { setConfig: { theme: giscusTheme() } } }, GISCUS_ORIGIN);
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  function stripFrontmatter(md) {
    return md.replace(/^\uFEFF?---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, "");
  }

  function openReader(post, push) {
    if (!post) { return; }
    var path = post.path;
    var slug = slugFor(post);
    var pair = pairBySlug[slug];
    var commentSlug = (pair && pair.en && pair.th) ? pair.baseSlug : slug;
    rTitle.textContent = post.title || "Post";
    rGit.href = REPO_BASE + path;
    renderReaderLangs(slug);
    document.title = (post.title ? post.title + " \u00b7 " : "") + SITE_TITLE;
    if (push !== false) { pushUrl(urlForSlug(slug)); }
    rBody.innerHTML = '<div class="reader-loading">Loading\u2026</div>';
    reader.classList.add("open");
    // Lock the root element too: html has overflow-x:hidden, so the viewport
    // scrollbar comes from <html>, not <body> — locking body alone leaves the
    // background page scrollable and shows a second scrollbar behind the reader.
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);

    fetch(RAW_BASE + path + "?_=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) { throw new Error("HTTP " + r.status); } return r.text(); })
      .then(function (md) {
        md = stripFrontmatter(md);
        var html;
        if (window.marked) {
          try { window.marked.setOptions({ breaks: true, gfm: true }); } catch (e) {}
          html = window.marked.parse(md);
        } else {
          html = "<pre>" + esc(md) + "</pre>";
        }
        rBody.innerHTML = '<article class="prose">' + html + "</article>";
        rBody.querySelectorAll("img").forEach(function (img) {
          var s = img.getAttribute("src") || "";
          var abs;
          if (/^(https?:|data:|\/\/)/.test(s)) {
            abs = s;
          } else if (s.charAt(0) === "/") {
            abs = ASSET_BASE + s;                       // "/ntz48/x.png" -> .../public/ntz48/x.png
          } else {
            abs = ASSET_BASE + "/" + s.replace(/^\.?\//, "");
          }
          if (/\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(abs)) {
            var v = document.createElement("video");
            v.src = abs;
            v.controls = true;
            v.playsInline = true;
            v.preload = "metadata";
            v.className = "prose-video";
            img.replaceWith(v);
          } else {
            img.src = abs;
            img.loading = "eager";
            img.decoding = "async";
          }
        });
        rBody.querySelectorAll("a").forEach(function (a) {
          var h = a.getAttribute("href") || "";
          var isExternal = /^(https?:|mailto:|tel:|#|data:|\/\/)/.test(h);
          var isAsset = /\.(png|jpe?g|gif|webp|svg|mp4|webm|mov|m4v|ogg|pdf)(\?.*)?$/i.test(h);
          var abs = h;
          if (!isExternal && isAsset) {
            abs = (h.charAt(0) === "/") ? ASSET_BASE + h : ASSET_BASE + "/" + h.replace(/^\.?\//, "");
          }
          if (/\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(abs) && !/^https?:/.test(h)) {
            var fig = document.createElement("figure");
            fig.className = "prose-figure";
            var v = document.createElement("video");
            v.src = abs;
            v.controls = true;
            v.playsInline = true;
            v.preload = "metadata";
            v.className = "prose-video";
            fig.appendChild(v);
            var cap = (a.textContent || "").replace(/^[\s\u{1F3A5}\u{1F4F9}\u25B6\uFE0F]+/u, "").trim();
            if (cap) {
              var fc = document.createElement("figcaption");
              fc.className = "prose-cap";
              fc.textContent = cap;
              fig.appendChild(fc);
            }
            var p = a.parentElement;
            if (p && p.tagName === "P" && p.children.length === 1 && p.textContent.trim() === (a.textContent || "").trim()) {
              p.replaceWith(fig);
            } else {
              a.replaceWith(fig);
            }
            return;
          }
          if (!isExternal && isAsset) { a.href = abs; }
          var pm = h.match(/^(?:https?:\/\/[^\/]+)?\/post\/([^\/?#]+)/);
          if (pm && bySlug[decodeURIComponent(pm[1])]) {
            var targetSlug = decodeURIComponent(pm[1]);
            a.href = urlForSlug(targetSlug);
            a.setAttribute("data-internal-slug", targetSlug);
            return;
          }
          if (h.charAt(0) !== "#") { a.target = "_blank"; a.rel = "noopener"; }
        });
        rBody.insertAdjacentHTML("beforeend",
          '<section class="post-comments"><h3 class="pc-title">Comments</h3>' +
          '<div class="pc-host" id="brComments"></div></section>');
        loadComments(commentSlug, document.getElementById("brComments"));
        rBody.scrollTop = 0;
      })
      .catch(function () {
        rBody.innerHTML =
          '<div class="reader-error">Couldn\u2019t load this post.<br>' +
          '<a href="' + REPO_BASE + path + '" target="_blank" rel="noopener">View it on GitHub \u2192</a></div>';
      });
  }

  function closeReader(push) {
    var wasOpen = reader.classList.contains("open");
    reader.classList.remove("open");
    rBody.innerHTML = "";
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.title = "Blog \u00b7 " + SITE_TITLE;
    if (push !== false && wasOpen) { pushUrl(listUrl()); }
  }

  listEl.addEventListener("click", function (e) {
    var card = e.target.closest(".post-card");
    if (!card) { return; }
    // Cards are real links now: let ctrl/cmd/shift/middle-click through to a new tab.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) { return; }
    e.preventDefault();
    var post = bySlug[card.getAttribute("data-slug")] ||
      { path: card.getAttribute("data-path"), title: card.getAttribute("data-title") };
    openReader(post, true);
  });
  rBody.addEventListener("click", function (e) {
    var link = e.target.closest("a[data-internal-slug]");
    if (!link) { return; }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) { return; }
    e.preventDefault();
    var target = bySlug[link.getAttribute("data-internal-slug")];
    if (target) { openReader(target, true); }
  });
  document.getElementById("brClose").addEventListener("click", function () { closeReader(true); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && reader.classList.contains("open")) { closeReader(true); }
  });
  // Browser back/forward moves between the post and the list.
  window.addEventListener("popstate", function () { route(); });
})();
