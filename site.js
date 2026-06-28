(function () {
  var THEME_KEY = "bsc-theme";
  var ID_KEY = "bsc-identity";

  /* ---------- theme ---------- */
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
  var savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
  if (!savedTheme) {
    savedTheme = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  applyTheme(savedTheme);

  /* ---------- identity (pfp + name only) ---------- */
  var identities = {
    online: {
      name: "blueskychan_",
      handle: "aka mindhas403 · she/they",
      avatar: "assets/avatar-online.webp",
      title: "blueskychan_ · about me"
    },
    irl: {
      name: "Phapoom Saksri",
      handle: "she/they",
      avatar: "assets/avatar-irl.webp",
      title: "Phapoom Saksri · about me"
    }
  };
  var segOnline = document.getElementById("segOnline");
  var segIrl = document.getElementById("segIrl");

  function applyIdentity(key) {
    var id = identities[key] || identities.online;
    var heroName = document.getElementById("heroName");
    var heroHandle = document.getElementById("heroHandle");
    var heroAvatar = document.getElementById("heroAvatar");
    if (heroName) { heroName.textContent = id.name; }
    if (heroHandle) { heroHandle.textContent = id.handle; }
    if (heroAvatar) { heroAvatar.src = id.avatar; }
    if (heroName) { document.title = id.title; }
    if (segOnline) { segOnline.classList.toggle("active", key === "online"); }
    if (segIrl) { segIrl.classList.toggle("active", key === "irl"); }
    try { localStorage.setItem(ID_KEY, key); } catch (e) {}
  }
  if (segOnline && segIrl) {
    segOnline.addEventListener("click", function () { applyIdentity("online"); });
    segIrl.addEventListener("click", function () { applyIdentity("irl"); });
    var savedId = null;
    try { savedId = localStorage.getItem(ID_KEY); } catch (e) {}
    applyIdentity(savedId === "irl" ? "irl" : "online");
  }

  /* ---------- generic selectable filters ---------- */
  document.querySelectorAll(".filter-row[data-target]").forEach(function (box) {
    var target = document.querySelector(box.getAttribute("data-target"));
    if (!target) { return; }
    box.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-filter]");
      if (!btn) { return; }
      var f = btn.getAttribute("data-filter");
      box.querySelectorAll("button").forEach(function (b) { b.classList.toggle("active", b === btn); });
      target.querySelectorAll("[data-cat]").forEach(function (el) {
        el.classList.toggle("hidden", f !== "all" && el.getAttribute("data-cat") !== f);
      });
    });
  });

  /* ---------- lightbox ---------- */
  var lightbox = document.getElementById("lightbox");
  var certGrid = document.getElementById("certGrid");
  if (lightbox && certGrid) {
    var lbImg = document.getElementById("lbImg");
    var lbTitle = document.getElementById("lbTitle");
    certGrid.addEventListener("click", function (e) {
      var card = e.target.closest(".cert-card");
      if (!card) { return; }
      var img = card.querySelector("img");
      var title = card.querySelector(".cc-title");
      lbImg.src = img.src;
      lbTitle.textContent = title ? title.textContent : "Certificate";
      lightbox.classList.add("open");
    });
    var closeLightbox = function () {
      lightbox.classList.remove("open");
      lbImg.removeAttribute("src");
    };
    document.getElementById("lbClose").addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) { closeLightbox(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && lightbox.classList.contains("open")) { closeLightbox(); }
    });
  }
})();
