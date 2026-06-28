(function () {
  var THEME_KEY = "bsc-theme";
  var ID_KEY = "bsc-identity";

  var identities = {
    online: {
      name: "blueskychan_",
      handle: "aka mindhas403 \u00b7 she/they",
      avatar: "assets/avatar-online.webp",
      title: "blueskychan_ \u00b7 about me"
    },
    irl: {
      name: "Phapoom Saksri",
      handle: "she/they",
      avatar: "assets/avatar-irl.webp",
      title: "Phapoom Saksri \u00b7 about me"
    }
  };

  function setText(id, val) { var el = document.getElementById(id); if (el) { el.textContent = val; } }
  function setSrc(id, val) { var el = document.getElementById(id); if (el) { el.src = val; } }

  function applyIdentity(key) {
    var id = identities[key] || identities.online;
    setText("heroName", id.name);
    setText("heroHandle", id.handle);
    setSrc("heroAvatar", id.avatar);
    if (document.getElementById("heroName")) { document.title = id.title; }
    var segOnline = document.getElementById("segOnline");
    var segIrl = document.getElementById("segIrl");
    if (segOnline) { segOnline.classList.toggle("active", key === "online"); }
    if (segIrl) { segIrl.classList.toggle("active", key === "irl"); }
    try { localStorage.setItem(ID_KEY, key); } catch (e) {}
  }

  var segOnlineBtn = document.getElementById("segOnline");
  var segIrlBtn = document.getElementById("segIrl");
  if (segOnlineBtn) { segOnlineBtn.addEventListener("click", function () { applyIdentity("online"); }); }
  if (segIrlBtn) { segIrlBtn.addEventListener("click", function () { applyIdentity("irl"); }); }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }
  var themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      applyTheme(cur === "dark" ? "light" : "dark");
    });
  }

  var savedTheme = null, savedId = null;
  try {
    savedTheme = localStorage.getItem(THEME_KEY);
    savedId = localStorage.getItem(ID_KEY);
  } catch (e) {}
  if (!savedTheme) {
    savedTheme = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  applyTheme(savedTheme);
  applyIdentity(savedId === "irl" ? "irl" : "online");

  function wireFilter(boxId, itemSel) {
    var box = document.getElementById(boxId);
    if (!box) { return; }
    box.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-filter]");
      if (!btn) { return; }
      var f = btn.getAttribute("data-filter");
      box.querySelectorAll("button").forEach(function (b) { b.classList.toggle("active", b === btn); });
      document.querySelectorAll(itemSel).forEach(function (item) {
        item.classList.toggle("hidden", f !== "all" && item.getAttribute("data-cat") !== f);
      });
    });
  }
  wireFilter("certFilters", "#certGrid .cert-card");
  wireFilter("repoFilters", "#repoList .repo-item");

  /* ---------- Live decimal age (counts from 17 Dec 2009) ---------- */
  var ageInt = document.getElementById("ageInt");
  var ageFrac = document.getElementById("ageFrac");
  if (ageInt && ageFrac) {
    var BIRTH_YEAR = 2009, BIRTH_MONTH = 11, BIRTH_DAY = 17; // 17 Dec 2009
    function decimalAge() {
      var now = new Date();
      var last = new Date(now.getFullYear(), BIRTH_MONTH, BIRTH_DAY, 0, 0, 0);
      if (now < last) { last = new Date(now.getFullYear() - 1, BIRTH_MONTH, BIRTH_DAY, 0, 0, 0); }
      var next = new Date(last.getFullYear() + 1, BIRTH_MONTH, BIRTH_DAY, 0, 0, 0);
      var years = last.getFullYear() - BIRTH_YEAR;
      return years + (now - last) / (next - last);
    }
    var tickAge = function () {
      var a = decimalAge();
      var whole = Math.floor(a);
      ageInt.textContent = String(whole);
      ageFrac.textContent = (a - whole).toFixed(6).slice(1); // ".493210"
    };
    tickAge();
    setInterval(tickAge, 60);
  }

  /* ---------- Working repos: expand + language bars ---------- */
  var REPO_LANGS = window.REPO_LANGS || {};
  var LANG_COLORS = {
    "C#": "#178600", "C++": "#f34b7d", "C": "#555555", "Python": "#3572A5",
    "Shell": "#89e051", "Dockerfile": "#384d54", "JavaScript": "#f1e05a",
    "TypeScript": "#3178c6", "Java": "#b07219", "Kotlin": "#A97BFF",
    "HTML": "#e34c26", "CSS": "#563d7c", "Batchfile": "#C1F12E",
    "Makefile": "#427819", "PowerShell": "#012456", "Go": "#00ADD8",
    "PHP": "#4F5D95", "Ruby": "#701516", "Smali": "#888888",
    "XML": "#0060ac", "JSON": "#292929", "Rust": "#dea584"
  };
  function langColor(name) { return LANG_COLORS[name] || "#9aa0a6"; }

  function buildDetail(item) {
    var key = item.getAttribute("data-repo");
    var url = item.getAttribute("data-url");
    var langs = REPO_LANGS[key];
    var detail = document.createElement("div");
    detail.className = "repo-detail";

    if (langs && langs.length) {
      var total = langs.reduce(function (s, l) { return s + l.pct; }, 0) || 1;
      var bar = document.createElement("div");
      bar.className = "rd-bar";
      langs.forEach(function (l) {
        var seg = document.createElement("span");
        seg.style.width = (l.pct / total * 100) + "%";
        seg.style.background = langColor(l.name);
        seg.title = l.name + " " + l.pct + "%";
        bar.appendChild(seg);
      });
      detail.appendChild(bar);

      var legend = document.createElement("div");
      legend.className = "rd-legend";
      langs.forEach(function (l) {
        var item2 = document.createElement("span");
        item2.className = "rd-leg";
        item2.innerHTML = '<i style="background:' + langColor(l.name) + '"></i>' +
          '<b>' + l.name + '</b> ' + l.pct + '%';
        legend.appendChild(item2);
      });
      detail.appendChild(legend);
    } else {
      var note = document.createElement("div");
      note.className = "rd-note";
      note.textContent = "Language breakdown coming from GitHub.";
      detail.appendChild(note);
    }

    var src = document.createElement("a");
    src.className = "rd-source";
    src.href = url;
    src.target = "_blank";
    src.rel = "noopener";
    src.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path></svg> View source on GitHub' +
      '<svg viewBox="0 0 16 16"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z"></path></svg>';
    detail.appendChild(src);

    item.appendChild(detail);
    return detail;
  }

  var repoList = document.getElementById("repoList");
  if (repoList) {
    repoList.addEventListener("click", function (e) {
      var head = e.target.closest(".repo-head");
      if (!head) { return; }
      var item = head.closest(".repo-item");
      var open = item.classList.toggle("open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
      var detail = item.querySelector(".repo-detail");
      if (open && !detail) { detail = buildDetail(item); }
      if (detail) {
        if (open) {
          // Animate to the measured height, then release the cap to `none` so
          // the box settles to its real content height once async fonts (the
          // GitHub icon + JetBrains Mono) finish loading. A frozen pixel value
          // measured too early is what made the bottom spacing differ per row.
          detail.style.maxHeight = detail.scrollHeight + "px";
          detail.addEventListener("transitionend", function te(ev) {
            if (ev.target !== detail || ev.propertyName !== "max-height") { return; }
            detail.removeEventListener("transitionend", te);
            if (item.classList.contains("open")) { detail.style.maxHeight = "none"; }
          });
        } else {
          // Re-fix the current height before collapsing so it can animate from
          // a concrete value down to 0 (can't transition from `none`).
          detail.style.maxHeight = detail.scrollHeight + "px";
          void detail.offsetHeight; // force reflow so the next change animates
          detail.style.maxHeight = "0px";
        }
      }
    });
  }

  var lightbox = document.getElementById("lightbox");
  if (lightbox) {
    var lbImg = document.getElementById("lbImg");
    var lbTitle = document.getElementById("lbTitle");
    var lbMeta = document.getElementById("lbMeta");
    var lbCount = document.getElementById("lbCount");
    var lbPrev = document.getElementById("lbPrev");
    var lbNext = document.getElementById("lbNext");
    var grid = document.getElementById("certGrid");
    var gallery = [];
    var current = -1;

    function showAt(index) {
      if (index < 0 || index >= gallery.length) { return; }
      current = index;
      var card = gallery[index];
      var img = card.querySelector("img");
      var title = card.querySelector(".cc-title");
      var meta = card.querySelector(".cc-meta");
      if (lbImg && img) { lbImg.src = img.src; lbImg.alt = img.alt || "Certificate full view"; }
      if (lbTitle) { lbTitle.textContent = title ? title.textContent : "Certificate"; }
      if (lbMeta) { lbMeta.textContent = meta ? meta.textContent : ""; }
      if (lbCount) { lbCount.textContent = (index + 1) + " / " + gallery.length; }
      if (lbPrev) { lbPrev.disabled = index <= 0; }
      if (lbNext) { lbNext.disabled = index >= gallery.length - 1; }
    }

    function closeLightbox() { lightbox.classList.remove("open"); if (lbImg) { lbImg.removeAttribute("src"); } }

    if (grid) {
      grid.addEventListener("click", function (e) {
        var card = e.target.closest(".cert-card");
        if (!card) { return; }
        // Build the gallery from currently-visible cards so it respects the active filter.
        gallery = Array.prototype.filter.call(
          grid.querySelectorAll(".cert-card"),
          function (c) { return !c.classList.contains("hidden"); }
        );
        var index = gallery.indexOf(card);
        if (index < 0) { return; }
        showAt(index);
        lightbox.classList.add("open");
      });
    }
    if (lbPrev) { lbPrev.addEventListener("click", function () { showAt(current - 1); }); }
    if (lbNext) { lbNext.addEventListener("click", function () { showAt(current + 1); }); }
    var lbClose = document.getElementById("lbClose");
    if (lbClose) { lbClose.addEventListener("click", closeLightbox); }
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) { closeLightbox(); } });
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("open")) { return; }
      if (e.key === "Escape") { closeLightbox(); }
      else if (e.key === "ArrowLeft") { showAt(current - 1); }
      else if (e.key === "ArrowRight") { showAt(current + 1); }
    });
  }
})();
