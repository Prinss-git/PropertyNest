(function () {
  const D = window.PN_DATA;
  const { icon, cardHtml, PRICE_PRESETS, allListings, matches, favs, pesoShort, esc, load, save } = window.PN;
  const PER_PAGE = 12;

  // State mirrors the URL query string so searches are shareable and survive reloads.
  const NUM = ["min", "max", "beds", "baths", "minArea", "term", "page"];
  const BOOL = ["verified", "pets", "saved"];
  let state = {};

  function readUrl() {
    const p = new URLSearchParams(location.search);
    state = {
      mode: p.get("mode") || "",
      type: p.get("type") || "",
      q: p.get("q") || "",
      furnishing: p.get("furnishing") || "",
      sort: p.get("sort") || "relevance",
      amenities: p.get("amenities") ? p.get("amenities").split("|") : []
    };
    NUM.forEach((k) => (state[k] = p.get(k) ? Number(p.get(k)) : 0));
    BOOL.forEach((k) => (state[k] = p.get(k) === "1"));
    if (!state.page) state.page = 1;
  }

  function writeUrl() {
    const p = new URLSearchParams();
    ["mode", "type", "q", "furnishing"].forEach((k) => state[k] && p.set(k, state[k]));
    if (state.sort !== "relevance") p.set("sort", state.sort);
    NUM.forEach((k) => state[k] && !(k === "page" && state[k] === 1) && p.set(k, state[k]));
    BOOL.forEach((k) => state[k] && p.set(k, "1"));
    if (state.amenities.length) p.set("amenities", state.amenities.join("|"));
    history.replaceState(null, "", "listings.html" + (p.toString() ? "?" + p : ""));
  }

  function typesForMode(mode) {
    const present = new Set(allListings().filter((l) => !mode || l.mode === mode).map((l) => l.type));
    return Object.keys(D.TYPES).filter((t) => present.has(t));
  }

  // Rebuild the controls whose options depend on mode (type list, price presets, mode-only groups).
  function syncControls() {
    const $ = (id) => document.getElementById(id);
    document.querySelectorAll("#mode-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.mode));
    $("qb-q").value = state.q;

    const types = typesForMode(state.mode);
    if (state.type && !types.includes(state.type)) state.type = "";
    $("f-type").innerHTML = '<option value="">All types</option>' + types.map((t) => `<option value="${t}">${D.TYPES[t].label}</option>`).join("");
    $("f-type").value = state.type;

    const presetMode = state.mode || "buy";
    $("price-label").textContent = state.mode === "buy" ? "Price" : state.mode ? "Monthly rate" : "Price (select Buy/Rent/Lease for presets)";
    $("price-chips").innerHTML = state.mode ? PRICE_PRESETS[presetMode].map(([a, b, label]) =>
      `<button type="button" class="chip ${state.min === a && state.max === b ? "active" : ""}" data-min="${a}" data-max="${b}">${label}</button>`).join("") : "";
    $("f-min").value = state.min || "";
    $("f-max").value = state.max || "";

    document.querySelectorAll("[data-chip]").forEach((g) => {
      g.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", String(state[g.dataset.chip] || "") === c.dataset.v));
    });
    $("f-area").value = state.minArea || "";
    $("f-furn").value = state.furnishing;
    $("f-term").value = state.term || "";
    $("f-verified").checked = state.verified;
    $("f-pets").checked = state.pets;
    $("sort").value = state.sort;

    const resType = !state.type || ["condo", "house", "apartment", "townhouse"].includes(state.type);
    document.querySelectorAll('[data-for="residential"]').forEach((el) => el.classList.toggle("hidden", !resType || state.mode === "lease" && !state.type));
    document.querySelectorAll('[data-for="lease"]').forEach((el) => el.classList.toggle("hidden", state.mode !== "lease"));
    document.querySelectorAll('[data-for="rent"]').forEach((el) => el.classList.toggle("hidden", state.mode !== "rent"));
    document.querySelectorAll('[data-for="furnishing"]').forEach((el) => el.classList.toggle("hidden", state.type === "lot" || state.type === "warehouse"));

    const isCommercial = ["office", "commercial", "warehouse"].includes(state.type) || (state.mode === "lease" && !state.type);
    const pool = state.type === "lot" ? D.AMENITIES.lot : isCommercial ? D.AMENITIES.commercial : D.AMENITIES.residential;
    state.amenities = state.amenities.filter((a) => pool.includes(a));
    $("amen-checks").innerHTML = pool.map((a) =>
      `<label class="check"><input type="checkbox" value="${esc(a)}" ${state.amenities.includes(a) ? "checked" : ""}> ${esc(a)}</label>`).join("");
  }

  function titleText() {
    if (state.saved) return "Saved listings";
    const t = state.type ? D.TYPES[state.type].plural : "Properties";
    const m = state.mode ? " " + D.MODES[state.mode].verb.toLowerCase() : "";
    const where = state.q ? ` in ${state.q}` : " in the Philippines";
    return t + m + where;
  }

  function sortList(list) {
    const s = state.sort;
    const area = (l) => Math.max(l.floor, l.land);
    if (s === "newest") return list.sort((a, b) => b.posted.localeCompare(a.posted));
    if (s === "price-asc") return list.sort((a, b) => a.price - b.price);
    if (s === "price-desc") return list.sort((a, b) => b.price - a.price);
    if (s === "area-desc") return list.sort((a, b) => area(b) - area(a));
    return list.sort((a, b) => (b.featured - a.featured) || (b.verified - a.verified) || b.posted.localeCompare(a.posted));
  }

  function activeChips() {
    const chips = [];
    if (state.type) chips.push(["type", D.TYPES[state.type].label]);
    if (state.q) chips.push(["q", `"${state.q}"`]);
    if (state.min || state.max) chips.push(["price", `${state.min ? pesoShort(state.min) : "₱0"} – ${state.max ? pesoShort(state.max) : "any"}`]);
    if (state.beds) chips.push(["beds", state.beds + "+ beds"]);
    if (state.baths) chips.push(["baths", state.baths + "+ baths"]);
    if (state.minArea) chips.push(["minArea", state.minArea + "+ sqm"]);
    if (state.furnishing) chips.push(["furnishing", state.furnishing]);
    if (state.term) chips.push(["term", `≤ ${state.term}-yr term`]);
    if (state.verified) chips.push(["verified", "Verified"]);
    if (state.pets) chips.push(["pets", "Pet friendly"]);
    state.amenities.forEach((a) => chips.push(["amen:" + a, a]));
    return chips;
  }

  function render() {
    const title = titleText();
    document.getElementById("page-title").textContent = title;
    document.getElementById("crumb").textContent = state.saved ? "Saved" : state.mode ? D.MODES[state.mode].label : "All properties";
    document.title = title + " | PropertyNest";

    let list = allListings();
    if (state.saved) { const f = favs(); list = list.filter((l) => f.includes(l.id)); }
    list = sortList(list.filter((l) => matches(l, state)));

    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (state.page > pages) state.page = pages;
    const slice = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);

    document.getElementById("count").textContent = list.length;
    document.getElementById("count-label").textContent = list.length === 1 ? "property found" : "properties found";

    const results = document.getElementById("results");
    results.innerHTML = slice.length ? slice.map(cardHtml).join("") : `
      <div class="empty" style="grid-column:1/-1">
        ${icon("search", 40)}
        <h3>${state.saved ? "No saved listings yet" : "No properties match your search"}</h3>
        <p>${state.saved ? "Tap the heart on any listing to save it here." : "Try removing a filter or searching a nearby city."}</p>
        <a class="btn btn-outline" href="listings.html${state.mode ? "?mode=" + state.mode : ""}">${state.saved ? "Browse listings" : "Reset search"}</a>
      </div>`;

    document.getElementById("active-filters").innerHTML = activeChips().map(([k, label]) =>
      `<button type="button" class="chip" data-remove="${esc(k)}">${esc(label)} ${icon("x", 12)}</button>`).join("");

    const pg = document.getElementById("pagination");
    if (pages <= 1) { pg.innerHTML = ""; }
    else {
      let html = `<button data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""}>‹</button>`;
      for (let i = 1; i <= pages; i++) html += `<button data-page="${i}" class="${i === state.page ? "active" : ""}">${i}</button>`;
      html += `<button data-page="${state.page + 1}" ${state.page === pages ? "disabled" : ""}>›</button>`;
      pg.innerHTML = html;
    }
    writeUrl();
  }

  function update(patch, keepPage) {
    Object.assign(state, patch);
    if (!keepPage) state.page = 1;
    syncControls();
    render();
  }

  function bind() {
    const $ = (id) => document.getElementById(id);

    const dl = $("loc-list");
    const opts = new Set();
    D.LOCATIONS.forEach((l) => { opts.add(l.city); opts.add(l.province); l.areas.forEach((a) => opts.add(a)); });
    dl.innerHTML = [...opts].map((o) => `<option value="${esc(o)}">`).join("");

    $("open-filters").innerHTML = icon("filter", 16) + " Filters";
    document.querySelector('[data-view="grid"]').innerHTML = icon("grid", 18);
    document.querySelector('[data-view="list"]').innerHTML = icon("list", 18);

    $("mode-tabs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-mode]");
      if (b) update({ mode: b.dataset.mode, min: 0, max: 0, term: 0, pets: false, saved: false });
    });
    $("quickbar").addEventListener("submit", (e) => { e.preventDefault(); update({ q: $("qb-q").value.trim() }); });
    $("f-type").addEventListener("change", (e) => update({ type: e.target.value }));
    $("price-chips").addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (!c) return;
      const min = +c.dataset.min, max = +c.dataset.max;
      update(state.min === min && state.max === max ? { min: 0, max: 0 } : { min, max });
    });
    $("f-min").addEventListener("change", (e) => update({ min: +e.target.value || 0 }));
    $("f-max").addEventListener("change", (e) => update({ max: +e.target.value || 0 }));
    document.querySelectorAll("[data-chip]").forEach((g) => g.addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (c) update({ [g.dataset.chip]: +c.dataset.v || 0 });
    }));
    $("f-area").addEventListener("change", (e) => update({ minArea: +e.target.value || 0 }));
    $("f-furn").addEventListener("change", (e) => update({ furnishing: e.target.value }));
    $("f-term").addEventListener("change", (e) => update({ term: +e.target.value || 0 }));
    $("f-verified").addEventListener("change", (e) => update({ verified: e.target.checked }));
    $("f-pets").addEventListener("change", (e) => update({ pets: e.target.checked }));
    $("amen-checks").addEventListener("change", () => {
      update({ amenities: [...document.querySelectorAll("#amen-checks input:checked")].map((i) => i.value) });
    });
    $("sort").addEventListener("change", (e) => update({ sort: e.target.value }));
    $("clear-filters").addEventListener("click", () => update({ type: "", q: "", min: 0, max: 0, beds: 0, baths: 0, minArea: 0, furnishing: "", term: 0, verified: false, pets: false, amenities: [] }));

    $("active-filters").addEventListener("click", (e) => {
      const c = e.target.closest("[data-remove]");
      if (!c) return;
      const k = c.dataset.remove;
      if (k === "price") update({ min: 0, max: 0 });
      else if (k.startsWith("amen:")) update({ amenities: state.amenities.filter((a) => a !== k.slice(5)) });
      else update({ [k]: typeof state[k] === "boolean" ? false : typeof state[k] === "number" ? 0 : "" });
    });

    $("pagination").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-page]");
      if (!b || b.disabled) return;
      update({ page: +b.dataset.page }, true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const results = $("results");
    function setView(v) {
      results.classList.toggle("list", v === "list");
      document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
      save("pn_view", v);
    }
    document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    setView(load("pn_view", "grid"));

    $("open-filters").addEventListener("click", () => $("filters").classList.add("open"));
    $("close-filters").addEventListener("click", () => $("filters").classList.remove("open"));

    // Removing a favorite while viewing saved listings should drop it from the results.
    document.addEventListener("pn:favs", () => state.saved && render());
  }

  document.addEventListener("DOMContentLoaded", () => {
    readUrl();
    bind();
    syncControls();
    render();
  });
})();
