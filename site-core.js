(function () {
  var THEME_KEY = "bsc-theme";
  var ID_KEY = "bsc-identity";

  var identities = {
    online: {
      name: "blueskychan_",
      handle: "aka mindhas403 \u00b7 she/they",
      avatar: "assets/avatar-online.jpg",
      title: "blueskychan_ \u00b7 about me"
    },
    irl: {
      name: "Phapoom Saksri",
      handle: "she/they",
      avatar: "assets/avatar-irl.jpg",
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
    src.innerHTML = '<i class="ph-fill ph-github-logo"></i> View source on GitHub' +
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
        detail.style.maxHeight = open ? (detail.scrollHeight + "px") : "0px";
      }
    });
  }

  var lightbox = document.getElementById("lightbox");
  if (lightbox) {
    var lbImg = document.getElementById("lbImg");
    var lbTitle = document.getElementById("lbTitle");
    var grid = document.getElementById("certGrid");
    function closeLightbox() { lightbox.classList.remove("open"); if (lbImg) { lbImg.removeAttribute("src"); } }
    if (grid) {
      grid.addEventListener("click", function (e) {
        var card = e.target.closest(".cert-card");
        if (!card) { return; }
        var img = card.querySelector("img");
        var title = card.querySelector(".cc-title");
        if (lbImg && img) { lbImg.src = img.src; }
        if (lbTitle) { lbTitle.textContent = title ? title.textContent : "Certificate"; }
        lightbox.classList.add("open");
      });
    }
    var lbClose = document.getElementById("lbClose");
    if (lbClose) { lbClose.addEventListener("click", closeLightbox); }
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) { closeLightbox(); } });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && lightbox.classList.contains("open")) { closeLightbox(); }
    });
  }
})();
