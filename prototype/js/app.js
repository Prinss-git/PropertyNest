/* Shared PropertyNest code: icons, formatting, header/footer, cards, favorites, user listings. */
(function () {
  const D = window.PN_DATA;

  // ---------- Icons (inline SVG, stroke-based) ----------
  const P = {
    house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
    apartment: '<rect x="3" y="7" width="8" height="14"/><rect x="11" y="3" width="10" height="18"/><path d="M6 11h2M6 15h2M14 7h2M14 11h2M14 15h2M18 7h0M18 11h0"/>',
    townhouse: '<path d="M2 12l5-5 5 5M12 12l5-5 5 5"/><path d="M4 11v9h16v-9"/><path d="M7 20v-4M17 20v-4"/>',
    lot: '<path d="M3 20h18"/><path d="M5 20V9l4-3 4 3v11"/><path d="M15 20v-6l3-2 3 2v6" opacity=".5"/><path d="M3 4h4M17 4h4"/>',
    store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/>',
    office: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M3 13h18"/>',
    warehouse: '<path d="M2 9l10-5 10 5v11H2z"/><path d="M6 20v-8h12v8M6 15h12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    bed: '<path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 00-3-3h-7v6"/><circle cx="7" cy="11" r="2"/>',
    bath: '<path d="M4 12h16v3a5 5 0 01-5 5H9a5 5 0 01-5-5z"/><path d="M6 12V5a2 2 0 014 0"/><path d="M7 20l-1 2M17 20l1 2"/>',
    area: '<path d="M3 3h6M3 3v6M21 21h-6M21 21v-6M3 3l7 7M21 21l-7-7"/>',
    land: '<path d="M3 17l6-6 4 4 8-8"/><path d="M3 21h18"/>',
    car: '<path d="M5 17h14v-5l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
    camera: '<path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    logo: '<path d="M4 13l12-9 12 9" stroke-width="3"/><path d="M8 11v14h16V11" stroke-width="3"/><circle cx="16" cy="18" r="3.2" fill="#ff6b4a" stroke="none"/>'
  };
  function icon(name, size = 18, extra = "") {
    const vb = name === "logo" ? "0 0 32 32" : "0 0 24 24";
    return `<svg width="${size}" height="${size}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || ""}</svg>`;
  }

  // ---------- Formatting ----------
  function peso(n) {
    return "₱" + Math.round(n).toLocaleString("en-PH");
  }
  function pesoShort(n) {
    if (n >= 1e9) return "₱" + (n / 1e9).toFixed(n % 1e9 ? 2 : 0).replace(/\.?0+$/, "") + "B";
    if (n >= 1e6) return "₱" + (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (n >= 1e3) return "₱" + (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return "₱" + n;
  }
  function priceHtml(l) {
    const unit = D.MODES[l.mode].priceUnit;
    return `${peso(l.price)}${unit ? `<small> ${unit}</small>` : ""}`;
  }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function timeAgo(dateStr) {
    const days = Math.round((Date.now() - new Date(dateStr).getTime()) / 864e5);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return days + " days ago";
    const m = Math.round(days / 30);
    return m + (m === 1 ? " month ago" : " months ago");
  }

  // ---------- Storage (safe) ----------
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }

  // ---------- Listings (sample + user-posted) ----------
  function allListings() {
    return load("pn_user_listings", []).concat(D.LISTINGS);
  }
  function getListing(id) {
    return allListings().find((l) => l.id === id);
  }
  function addUserListing(l) {
    const list = load("pn_user_listings", []);
    list.unshift(l);
    save("pn_user_listings", list);
  }

  // ---------- Favorites ----------
  function favs() { return load("pn_favs", []); }
  function isFav(id) { return favs().includes(id); }
  function toggleFav(id) {
    const f = favs();
    const i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.push(id);
    save("pn_favs", f);
    updateFavBadge();
    return i < 0;
  }
  function updateFavBadge() {
    const b = document.querySelector("[data-fav-count]");
    if (!b) return;
    const n = favs().length;
    b.textContent = n;
    b.classList.toggle("hidden", n === 0);
  }

  // ---------- Toast ----------
  function toast(msg) {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // ---------- Image fallback ----------
  // Replaces a broken photo with a branded placeholder so cards never show a broken-image icon.
  function imgFallback(el) {
    el.onerror = null;
    el.style.display = "none";
    const parent = el.parentElement;
    if (parent && !parent.querySelector(".ph")) {
      const ph = document.createElement("div");
      ph.className = "ph";
      ph.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;opacity:.85";
      ph.innerHTML = icon(parent.dataset.icon || "house", 48);
      parent.appendChild(ph);
    }
  }
  window.pnImgFallback = imgFallback;

  // ---------- Card ----------
  function specsHtml(l) {
    const s = [];
    if (l.beds) s.push(`<span title="Bedrooms">${icon("bed", 16)} ${l.beds} Bed${l.beds > 1 ? "s" : ""}</span>`);
    else if (["condo", "apartment"].includes(l.type)) s.push(`<span>${icon("bed", 16)} Studio</span>`);
    if (l.baths) s.push(`<span title="Bathrooms">${icon("bath", 16)} ${l.baths} Bath${l.baths > 1 ? "s" : ""}</span>`);
    if (l.floor) s.push(`<span title="Floor area">${icon("area", 16)} ${l.floor.toLocaleString()} sqm</span>`);
    if (l.land) s.push(`<span title="Land area">${icon("land", 16)} ${l.land.toLocaleString()} sqm lot</span>`);
    return s.join("");
  }
  function cardHtml(l) {
    const m = D.MODES[l.mode];
    const t = D.TYPES[l.type];
    const fav = isFav(l.id);
    return `
      <article class="card">
        <a href="property.html?id=${encodeURIComponent(l.id)}" class="card-media" data-icon="${t.icon}">
          <img src="${esc(l.images[0] || "")}" alt="${esc(l.title)}" loading="lazy" onerror="pnImgFallback(this)">
          <div class="card-badges">
            <span class="tag ${m.color}">${m.verb}</span>
            ${l.featured ? '<span class="tag featured">Featured</span>' : ""}
            ${l.verified ? `<span class="tag verified">${icon("check", 12)} Verified</span>` : ""}
          </div>
          <span class="photo-count">${icon("camera", 13)} ${l.images.length}</span>
        </a>
        <button class="fav-btn ${fav ? "on" : ""}" data-fav="${esc(l.id)}" aria-label="Save listing">${icon("heart", 18)}</button>
        <div class="card-body">
          <div class="price">${priceHtml(l)}</div>
          ${l.mode === "lease" ? `<span class="lease-term">Min. ${l.minTerm}-year lease · ${l.escalation}% escalation</span>` : ""}
          ${l.mode === "rent" ? `<span class="lease-term" style="color:var(--rent);background:#eaf1fe">${l.deposit} mo. deposit · ${l.advance} mo. advance</span>` : ""}
          <a href="property.html?id=${encodeURIComponent(l.id)}" class="card-title">${esc(l.title)}</a>
          <div class="card-loc">${icon("pin", 14)} ${esc(l.area)}, ${esc(l.city)}</div>
          <p class="card-desc">${esc(l.description)}</p>
          <div class="specs">${specsHtml(l) || `<span>${icon("tag", 16)} ${t.label}</span>`}</div>
        </div>
      </article>`;
  }
  // The fav button sits outside the media link but must overlay it.
  const cardStyle = document.createElement("style");
  cardStyle.textContent = ".card{position:relative}.card>.fav-btn{z-index:2}";
  document.head.appendChild(cardStyle);

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav]");
    if (!b) return;
    e.preventDefault();
    const on = toggleFav(b.dataset.fav);
    document.querySelectorAll(`[data-fav="${CSS.escape(b.dataset.fav)}"]`).forEach((x) => x.classList.toggle("on", on));
    toast(on ? "Saved to your favorites" : "Removed from favorites");
    document.dispatchEvent(new CustomEvent("pn:favs"));
  });

  // ---------- Header / Footer ----------
  function renderHeader() {
    const el = document.getElementById("site-header");
    if (!el) return;
    const params = new URLSearchParams(location.search);
    const page = location.pathname.split("/").pop() || "index.html";
    const mode = page === "listings.html" ? params.get("mode") : null;
    const favPage = page === "listings.html" && params.get("saved") === "1";
    // Each mode gets a dropdown of its property types (with live counts) plus a few shortcut searches.
    const MENUS = {
      buy: {
        types: ["condo", "house", "townhouse", "lot", "commercial"],
        all: "All properties for sale",
        extras: [["listings.html?mode=buy&sort=newest", "Newly listed"], ["index.html#calculator", "Home loan calculator"]]
      },
      rent: {
        types: ["condo", "apartment", "house", "townhouse"],
        all: "All properties for rent",
        extras: [["listings.html?mode=rent&furnishing=Fully%20Furnished", "Fully furnished"], ["listings.html?mode=rent&pets=1", "Pet friendly"]]
      },
      lease: {
        types: ["office", "commercial", "warehouse", "house", "condo", "lot"],
        all: "All properties for lease",
        extras: [["listings.html?mode=lease&amenities=PEZA%20Accredited", "PEZA-accredited spaces"], ["listings.html?mode=lease&term=1", "1-year terms or shorter"]]
      }
    };
    const listings = allListings();
    function menuHtml(m) {
      const cfg = MENUS[m];
      const types = cfg.types.map((t) => {
        const n = listings.filter((l) => l.mode === m && l.type === t).length;
        return `<a href="listings.html?mode=${m}&type=${t}">${icon(D.TYPES[t].icon, 16)}<span>${D.TYPES[t].plural}</span><em>${n}</em></a>`;
      }).join("");
      return `<div class="nav-menu" role="menu">
        <div class="nav-menu-label">${D.MODES[m].verb}</div>
        ${types}
        <div class="nav-menu-sep"></div>
        ${cfg.extras.map(([h, t]) => `<a href="${h}" class="nav-menu-extra">${t}</a>`).join("")}
        <a href="listings.html?mode=${m}" class="nav-menu-all">${cfg.all} →</a>
      </div>`;
    }
    const modeItems = ["buy", "rent", "lease"].map((m) => `
      <div class="nav-item">
        <a href="listings.html?mode=${m}" class="nav-link ${mode === m ? "active" : ""}">${D.MODES[m].label}</a>
        <button type="button" class="nav-caret" aria-expanded="false" aria-label="Show ${D.MODES[m].label} options">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        ${menuHtml(m)}
      </div>`).join("");
    el.className = "site-header";
    el.innerHTML = `
      <div class="container header-inner">
        <a href="index.html" class="logo">${icon("logo", 30)} <b style="font-weight:inherit">Property<span>Nest</span></b></a>
        <nav class="main-nav" id="main-nav">
          ${modeItems}
          <a href="index.html#calculator" class="nav-link">Home Loan Calculator</a>
          <a href="index.html#locations" class="nav-link">Locations</a>
        </nav>
        <div class="header-actions">
          <a href="listings.html?saved=1" class="icon-btn ${favPage ? "active" : ""}" title="Saved listings" aria-label="Saved listings">
            ${icon("heart", 18)}<span class="badge hidden" data-fav-count>0</span>
          </a>
          <a href="post.html" class="btn btn-primary btn-sm">${icon("plus", 16)}<span class="btn-post-text">List Property</span></a>
          <button class="icon-btn menu-toggle" aria-label="Menu" id="menu-toggle">${icon("menu", 20)}</button>
        </div>
      </div>`;
    document.getElementById("menu-toggle").addEventListener("click", () => document.getElementById("main-nav").classList.toggle("open"));

    // Hover opens menus on desktop (CSS); the caret button toggles them for touch and keyboard users.
    const items = el.querySelectorAll(".nav-item");
    const closeAll = (except) => items.forEach((it) => {
      if (it === except) return;
      it.classList.remove("open");
      it.querySelector(".nav-caret").setAttribute("aria-expanded", "false");
    });
    items.forEach((it) => {
      const caret = it.querySelector(".nav-caret");
      caret.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = !it.classList.contains("open");
        closeAll(it);
        it.classList.toggle("open", open);
        caret.setAttribute("aria-expanded", String(open));
      });
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".nav-item")) closeAll(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
    updateFavBadge();
  }

  function renderFooter() {
    const el = document.getElementById("site-footer");
    if (!el) return;
    const cities = ["Makati", "Taguig", "Quezon City", "Pasig", "Cebu City", "Davao City"];
    el.className = "site-footer";
    el.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <a href="index.html" class="logo">${icon("logo", 28)} <b style="font-weight:inherit">Property<span>Nest</span></b></a>
            <p style="font-size:14px;max-width:320px;margin:0">Find a place to buy, rent, or lease across the Philippines: homes, condos, offices, retail spaces, and warehouses.</p>
          </div>
          <div><h4>Buy</h4><ul>
            <li><a href="listings.html?mode=buy&type=condo">Condos for Sale</a></li>
            <li><a href="listings.html?mode=buy&type=house">Houses for Sale</a></li>
            <li><a href="listings.html?mode=buy&type=townhouse">Townhouses for Sale</a></li>
            <li><a href="listings.html?mode=buy&type=lot">Lots for Sale</a></li>
          </ul></div>
          <div><h4>Rent</h4><ul>
            <li><a href="listings.html?mode=rent&type=condo">Condos for Rent</a></li>
            <li><a href="listings.html?mode=rent&type=apartment">Apartments for Rent</a></li>
            <li><a href="listings.html?mode=rent&type=house">Houses for Rent</a></li>
            <li><a href="listings.html?mode=rent&furnishing=Fully%20Furnished">Furnished Rentals</a></li>
          </ul></div>
          <div><h4>Lease</h4><ul>
            <li><a href="listings.html?mode=lease&type=office">Office Space</a></li>
            <li><a href="listings.html?mode=lease&type=commercial">Retail & Commercial</a></li>
            <li><a href="listings.html?mode=lease&type=warehouse">Warehouses</a></li>
            <li><a href="listings.html?mode=lease&type=lot">Lots for Lease</a></li>
          </ul></div>
          <div><h4>Popular Cities</h4><ul>
            ${cities.map((c) => `<li><a href="listings.html?q=${encodeURIComponent(c)}">${c}</a></li>`).join("")}
          </ul></div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 PropertyNest. Sample listings for demonstration only.</span>
          <span><a href="post.html">List your property</a> · <a href="listings.html?saved=1">Saved listings</a></span>
        </div>
      </div>`;
  }

  // ---------- Filtering (shared by home + listings) ----------
  function matches(l, f) {
    if (f.mode && l.mode !== f.mode) return false;
    if (f.type && l.type !== f.type) return false;
    if (f.q) {
      const hay = `${l.title} ${l.city} ${l.province} ${l.area} ${D.TYPES[l.type].label}`.toLowerCase();
      if (!f.q.toLowerCase().split(/[\s,]+/).filter(Boolean).every((w) => hay.includes(w))) return false;
    }
    if (f.min && l.price < f.min) return false;
    if (f.max && l.price > f.max) return false;
    if (f.beds && l.beds < f.beds) return false;
    if (f.baths && l.baths < f.baths) return false;
    if (f.minArea && Math.max(l.floor, l.land) < f.minArea) return false;
    if (f.furnishing && l.furnishing !== f.furnishing) return false;
    if (f.term && (l.mode !== "lease" || l.minTerm > f.term)) return false;
    if (f.verified && !l.verified) return false;
    if (f.pets && !l.petFriendly) return false;
    if (f.amenities && f.amenities.length && !f.amenities.every((a) => l.amenities.includes(a))) return false;
    return true;
  }

  // Price presets differ by mode: buy is total price, rent/lease is monthly.
  const PRICE_PRESETS = {
    buy:   [[0, 5e6, "Under ₱5M"], [5e6, 10e6, "₱5M – ₱10M"], [10e6, 20e6, "₱10M – ₱20M"], [20e6, 50e6, "₱20M – ₱50M"], [50e6, 0, "₱50M+"]],
    rent:  [[0, 20000, "Under ₱20K"], [20000, 40000, "₱20K – ₱40K"], [40000, 80000, "₱40K – ₱80K"], [80000, 150000, "₱80K – ₱150K"], [150000, 0, "₱150K+"]],
    lease: [[0, 100000, "Under ₱100K"], [100000, 250000, "₱100K – ₱250K"], [250000, 500000, "₱250K – ₱500K"], [500000, 1000000, "₱500K – ₱1M"], [1000000, 0, "₱1M+"]]
  };

  document.addEventListener("DOMContentLoaded", () => {
    renderHeader();
    renderFooter();
  });

  window.PN = { icon, peso, pesoShort, priceHtml, esc, timeAgo, load, save, allListings, getListing, addUserListing, favs, isFav, toggleFav, toast, cardHtml, specsHtml, matches, PRICE_PRESETS, updateFavBadge };
})();
