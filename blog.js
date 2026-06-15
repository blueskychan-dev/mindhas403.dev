(function () {
  var listEl = document.getElementById("blogList");
  if (!listEl) { return; }

  var JSON_URL = "https://raw.githubusercontent.com/blueskychan-dev/blogs/main/blogs.json";
  var RAW_BASE = "https://raw.githubusercontent.com/blueskychan-dev/blogs/main/";
  var ASSET_BASE = "https://raw.githubusercontent.com/blueskychan-dev/blogs/main/public"; // post images live under /public
  var REPO_BASE = "https://github.com/blueskychan-dev/blogs/blob/main/";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
      if (countEl) { countEl.textContent = posts.length; }
      bySlug = {};
      posts.forEach(function (p) { bySlug[slugFor(p)] = p; });
      render(posts);
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

  function render(posts) {
    if (!posts.length) {
      listEl.innerHTML =
        '<div class="empty-state"><div class="es-emoji">\u270d\ufe0f</div>' +
        '<div class="es-title">No posts yet</div>' +
        '<div class="es-sub">First posts are coming soon. Check back later!</div></div>';
      return;
    }
    listEl.innerHTML = posts.map(function (p) {
      var tags = (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
      return '<button class="post-card" type="button" data-slug="' + esc(slugFor(p)) + '" data-path="' + esc(p.path) + '" data-title="' + esc(p.title) + '">' +
        '<div class="post-meta"><span class="post-date">' + esc(fmtDate(p.date)) + "</span>" +
        '<span class="post-tags">' + tags + "</span></div>" +
        '<div class="post-title">' + esc(p.title) + "</div>" +
        (p.desc ? '<div class="post-desc">' + esc(p.desc) + "</div>" : "") +
        "</button>";
    }).join("");
  }

  // ---------- Reader ----------
  var reader = document.getElementById("blogReader");
  var rTitle = document.getElementById("brTitle");
  var rBody = document.getElementById("brBody");
  var rGit = document.getElementById("brGithub");

  function stripFrontmatter(md) {
    return md.replace(/^\uFEFF?---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, "");
  }

  function openReader(post, push) {
    if (!post) { return; }
    var path = post.path;
    var slug = slugFor(post);
    rTitle.textContent = post.title || "Post";
    rGit.href = REPO_BASE + path;
    document.title = (post.title ? post.title + " \u00b7 " : "") + SITE_TITLE;
    if (push !== false) { pushUrl(urlForSlug(slug)); }
    rBody.innerHTML = '<div class="reader-loading">Loading\u2026</div>';
    reader.classList.add("open");
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
          if (h.charAt(0) !== "#") { a.target = "_blank"; a.rel = "noopener"; }
        });
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
    document.body.style.overflow = "";
    document.title = "Blog \u00b7 " + SITE_TITLE;
    if (push !== false && wasOpen) { pushUrl(listUrl()); }
  }

  listEl.addEventListener("click", function (e) {
    var card = e.target.closest(".post-card");
    if (!card) { return; }
    var post = bySlug[card.getAttribute("data-slug")] ||
      { path: card.getAttribute("data-path"), title: card.getAttribute("data-title") };
    openReader(post, true);
  });
  document.getElementById("brClose").addEventListener("click", function () { closeReader(true); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && reader.classList.contains("open")) { closeReader(true); }
  });
  // Browser back/forward moves between the post and the list.
  window.addEventListener("popstate", function () { route(); });
})();
