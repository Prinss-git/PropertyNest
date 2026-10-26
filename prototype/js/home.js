(function () {
  const D = window.PN_DATA;
  const { icon, cardHtml, pesoShort, PRICE_PRESETS, allListings, esc } = window.PN;

  const MODE_TYPES = {
    buy: ["condo", "house", "townhouse", "lot", "commercial"],
    rent: ["condo", "apartment", "house", "townhouse"],
    lease: ["office", "commercial", "warehouse", "house", "condo", "lot"]
  };
  const HINTS = {
    buy: "<strong>Buy:</strong> prices are the total selling price. Filter by title status and financing options.",
    rent: "<strong>Rent:</strong> monthly rates for homes, usually 6–12 month contracts with deposit and advance.",
    lease: "<strong>Lease:</strong> long-term contracts (1–5+ years) for offices, retail, warehouses, and homes."
  };

  let heroMode = "buy";

  function fillHeroSelects() {
    const typeSel = document.getElementById("type");
    typeSel.innerHTML = '<option value="">All types</option>' +
      MODE_TYPES[heroMode].map((t) => `<option value="${t}">${D.TYPES[t].label}</option>`).join("");
    const priceSel = document.getElementById("price");
    priceSel.innerHTML = '<option value="">Any price</option>' +
      PRICE_PRESETS[heroMode].map(([a, b, label]) => `<option value="${a}-${b}">${label}${heroMode === "buy" ? "" : " /mo"}</option>`).join("");
    document.getElementById("search-hint").innerHTML = HINTS[heroMode];
  }

  function initHero() {
    const dl = document.getElementById("loc-list");
    const opts = new Set();
    D.LOCATIONS.forEach((l) => { opts.add(l.city); opts.add(l.province); l.areas.forEach((a) => opts.add(`${a}, ${l.city}`)); });
    dl.innerHTML = [...opts].map((o) => `<option value="${esc(o)}">`).join("");

    document.querySelectorAll(".search-tab").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".search-tab").forEach((x) => x.classList.toggle("active", x === b));
      heroMode = b.dataset.mode;
      fillHeroSelects();
    }));
    fillHeroSelects();

    document.getElementById("hero-search").addEventListener("submit", (e) => {
      e.preventDefault();
      const p = new URLSearchParams({ mode: heroMode });
      const q = document.getElementById("q").value.trim();
      const type = document.getElementById("type").value;
      const price = document.getElementById("price").value;
      if (q) p.set("q", q);
      if (type) p.set("type", type);
      if (price) {
        const [min, max] = price.split("-").map(Number);
        if (min) p.set("min", min);
        if (max) p.set("max", max);
      }
      location.href = "listings.html?" + p.toString();
    });

    const all = allListings();
    const count = (m) => all.filter((l) => l.mode === m).length;
    document.getElementById("hero-stats").innerHTML = `
      <div><strong>${count("buy")}</strong><span>Properties for sale</span></div>
      <div><strong>${count("rent")}</strong><span>Homes for rent</span></div>
      <div><strong>${count("lease")}</strong><span>Spaces for lease</span></div>
      <div><strong>${D.LOCATIONS.length}</strong><span>Cities covered</span></div>`;
  }

  function initModes() {
    const cards = [
      { mode: "buy", icon: "key", color: "var(--buy)", title: "Buy", text: "Own a home, condo, or lot. See total prices, title status, and financing options.",
        points: ["Clean title & RFO filters", "Bank, Pag-IBIG & in-house financing", "Built-in loan calculator"] },
      { mode: "rent", icon: "house", color: "var(--rent)", title: "Rent", text: "Monthly rentals for condos, apartments, and houses, from short stays to yearly contracts.",
        points: ["Monthly rates with deposit & advance shown", "Furnished / pet-friendly filters", "6–12 month minimum stays"] },
      { mode: "lease", icon: "office", color: "var(--lease)", title: "Lease", text: "Long-term leases for businesses and families: offices, retail, warehouses, and homes.",
        points: ["Lease term & annual escalation shown", "CUSA and fit-out details", "PEZA-accredited spaces"] }
    ];
    document.getElementById("mode-grid").innerHTML = cards.map((c) => `
      <div class="mode-card">
        <div class="mode-icon" style="background:${c.color}">${icon(c.icon, 24)}</div>
        <h3>${c.title}</h3>
        <p>${c.text}</p>
        <ul>${c.points.map((p) => `<li>${p}</li>`).join("")}</ul>
        <a class="link-more" href="listings.html?mode=${c.mode}">Browse ${c.title.toLowerCase()} listings →</a>
      </div>`).join("");
  }

  function renderTypes(mode) {
    const all = allListings().filter((l) => l.mode === mode);
    document.getElementById("type-sub").textContent = `Showing what's available to ${D.MODES[mode].label.toLowerCase()}`;
    document.getElementById("type-grid").innerHTML = MODE_TYPES[mode].map((t) => {
      const n = all.filter((l) => l.type === t).length;
      return `<a class="type-card" href="listings.html?mode=${mode}&type=${t}">
        <div class="ti">${icon(D.TYPES[t].icon, 22)}</div>
        <strong>${D.TYPES[t].plural}</strong>
        <span>${n} listing${n === 1 ? "" : "s"}</span>
      </a>`;
    }).join("");
  }

  function renderFeatured(mode) {
    const list = allListings().filter((l) => l.mode === mode).sort((a, b) => (b.featured - a.featured) || (b.verified - a.verified)).slice(0, 8);
    document.getElementById("featured-grid").innerHTML = list.map(cardHtml).join("");
    const more = document.getElementById("featured-more");
    more.href = `listings.html?mode=${mode}`;
    more.textContent = `View all properties ${D.MODES[mode].verb.toLowerCase()}`;
  }

  function initSwitches() {
    document.querySelectorAll("[data-switch]").forEach((group) => {
      group.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-mode]");
        if (!b) return;
        group.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
        if (group.dataset.switch === "types") renderTypes(b.dataset.mode);
        else renderFeatured(b.dataset.mode);
      });
    });
    renderTypes("buy");
    renderFeatured("buy");
  }

  function initLocations() {
    const pics = {
      "Taguig": "1555217851-6141535bd771",
      "Makati": "1518548419970-58e3b4079ab2",
      "Cebu City": "1570789210967-2cac24afeb00",
      "Quezon City": "1519501025264-65ba15a82390",
      "Pasig": "1480714378408-67cf0d13bc1b",
      "Davao City": "1506905925346-21bda4d32df4",
      "Baguio": "1464822759023-fed622ff2c3b"
    };
    const all = allListings();
    const cities = Object.keys(pics);
    document.getElementById("loc-grid").innerHTML = cities.map((c, i) => {
      const n = all.filter((l) => l.city === c).length;
      const prov = D.LOCATIONS.find((l) => l.city === c).province;
      return `<a class="loc-card ${i === 0 ? "big" : ""}" href="listings.html?q=${encodeURIComponent(c)}" data-icon="pin">
        <img src="${D.img(pics[c])}" alt="${c}" loading="lazy" onerror="pnImgFallback(this)">
        <div class="ov"><strong>${c}</strong><span>${prov} · ${n} listings</span></div>
      </a>`;
    }).join("");
  }

  function initLatest() {
    const list = allListings().slice().sort((a, b) => b.posted.localeCompare(a.posted)).slice(0, 4);
    document.getElementById("latest-grid").innerHTML = list.map(cardHtml).join("");
  }

  function initCalc() {
    const $ = (id) => document.getElementById(id);
    function calc() {
      const price = Math.max(0, +$("c-price").value || 0);
      const downPct = +$("c-down").value;
      const rate = (+$("c-rate").value || 0) / 100 / 12;
      const n = +$("c-years").value * 12;
      const down = price * downPct / 100;
      const loan = price - down;
      const monthly = rate ? loan * rate / (1 - Math.pow(1 + rate, -n)) : loan / n;
      $("c-down-v").textContent = downPct + "%";
      $("c-monthly").textContent = window.PN.peso(monthly);
      $("c-loan").textContent = window.PN.peso(loan);
      $("c-downamt").textContent = window.PN.peso(down);
      $("c-interest").textContent = window.PN.peso(monthly * n - loan);
      $("c-browse").href = `listings.html?mode=buy&max=${Math.round(price)}`;
      $("c-browse").textContent = `Browse homes up to ${pesoShort(price)}`;
    }
    ["c-price", "c-down", "c-rate", "c-years"].forEach((id) => $(id).addEventListener("input", calc));
    calc();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initHero();
    initModes();
    initSwitches();
    initLocations();
    initLatest();
    initCalc();
  });
})();
