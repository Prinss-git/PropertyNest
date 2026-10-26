(function () {
  const D = window.PN_DATA;
  const { icon, peso, priceHtml, esc, getListing, allListings, cardHtml, isFav, toggleFav, toast, timeAgo, load, save } = window.PN;

  function costBox(l) {
    if (l.mode === "buy") {
      const down = l.price * 0.2, loan = l.price - down, r = 0.075 / 12, n = 240;
      const monthly = loan * r / (1 - Math.pow(1 + r, -n));
      return `<div class="cost-box">
        <div class="row"><span>20% down payment</span><strong>${peso(down)}</strong></div>
        <div class="row"><span>Loan amount</span><strong>${peso(loan)}</strong></div>
        <div class="row total"><span>Est. monthly (20 yrs @ 7.5%)</span><span>${peso(monthly)}</span></div>
        <a class="link-more" style="font-size:13px" href="index.html#calculator">Adjust in loan calculator →</a>
      </div>`;
    }
    if (l.mode === "rent") {
      const dep = l.price * l.deposit, adv = l.price * l.advance;
      return `<div class="cost-box">
        <div class="row"><span>Monthly rent</span><strong>${peso(l.price)}</strong></div>
        <div class="row"><span>Security deposit (${l.deposit} mo.)</span><strong>${peso(dep)}</strong></div>
        <div class="row"><span>Advance rent (${l.advance} mo.)</span><strong>${peso(adv)}</strong></div>
        <div class="row total"><span>Move-in cost</span><span>${peso(dep + adv)}</span></div>
      </div>`;
    }
    // Lease: show escalated rent per year across the minimum term.
    let total = 0;
    const years = [];
    for (let y = 0; y < l.minTerm; y++) {
      const m = l.price * Math.pow(1 + l.escalation / 100, y);
      years.push(`<div class="row"><span>Year ${y + 1}</span><span>${peso(m)}/mo</span></div>`);
      total += m * 12;
    }
    const cusa = l.cusa && l.floor ? l.cusa * l.floor : 0;
    return `<div class="cost-box">
      ${years.join("")}
      ${cusa ? `<div class="row"><span>CUSA (₱${l.cusa}/sqm)</span><span>${peso(cusa)}/mo</span></div>` : ""}
      <div class="row"><span>Deposit + advance</span><span>${l.deposit} + ${l.advance} mo.</span></div>
      <div class="row total"><span>Total rent, ${l.minTerm}-yr term</span><span>${peso(total)}</span></div>
    </div>`;
  }

  function factsHtml(l) {
    const f = [];
    const t = D.TYPES[l.type];
    f.push(["Type", t.label]);
    if (l.beds || ["condo", "apartment"].includes(l.type)) f.push(["Bedrooms", l.beds || "Studio"]);
    if (l.baths) f.push(["Bathrooms", l.baths]);
    if (l.floor) f.push(["Floor area", l.floor.toLocaleString() + " sqm"]);
    if (l.land) f.push(["Lot area", l.land.toLocaleString() + " sqm"]);
    if (l.parking) f.push(["Parking", l.parking + " slot" + (l.parking > 1 ? "s" : "")]);
    if (l.mode === "lease") f.push(["Min. term", l.minTerm + " year" + (l.minTerm > 1 ? "s" : "")]);
    if (l.mode === "rent") f.push(["Min. stay", l.minStay + " months"]);
    if (l.mode === "buy") f.push(["Status", l.titleStatus]);
    return f.slice(0, 8).map(([k, v]) => `<div class="fact"><span>${k}</span><strong>${esc(v)}</strong></div>`).join("");
  }

  function specRows(l) {
    const rows = [
      ["Listing ID", l.id],
      ["Listing type", D.MODES[l.mode].verb],
      ["Property type", D.TYPES[l.type].label],
      ["Location", `${l.area}, ${l.city}, ${l.province}`],
      ["Furnishing", l.furnishing],
      ["Posted", `${l.posted} (${timeAgo(l.posted)})`]
    ];
    if (l.mode === "buy") {
      rows.push(["Price per sqm", l.floor || l.land ? peso(l.price / (l.floor || l.land)) : "—"]);
      rows.push(["Financing", (l.financing || []).join(", ")]);
    }
    if (l.mode === "rent") {
      rows.push(["Deposit / advance", `${l.deposit} month(s) / ${l.advance} month(s)`]);
      rows.push(["Pet friendly", l.petFriendly ? "Yes" : "No"]);
    }
    if (l.mode === "lease") {
      rows.push(["Annual escalation", l.escalation + "%"]);
      rows.push(["Deposit / advance", `${l.deposit} months / ${l.advance} months`]);
      if (l.cusa) rows.push(["CUSA", `₱${l.cusa} per sqm / month`]);
      if (l.floor) rows.push(["Rate per sqm", peso(l.price / l.floor) + " / month"]);
    }
    return rows.filter(([, v]) => v && v !== "N/A").map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join("");
  }

  function render(l) {
    const m = D.MODES[l.mode];
    const t = D.TYPES[l.type];
    document.title = `${l.title} | PropertyNest`;
    const imgs = l.images;
    const initials = l.agent.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
    const similar = allListings().filter((x) => x.id !== l.id && x.mode === l.mode && (x.type === l.type || x.city === l.city)).slice(0, 4);
    const mapUrl = `https://www.openstreetmap.org/?mlat=${l.lat.toFixed(5)}&mlon=${l.lng.toFixed(5)}#map=15/${l.lat.toFixed(5)}/${l.lng.toFixed(5)}`;
    const enquiry = l.mode === "buy" ? "I'm interested in buying this property. Is it still available? I'd like to schedule a viewing."
      : l.mode === "rent" ? "Hi! I'd like to rent this unit. Is it still available, and when can I view it?"
      : "Hello, our company is interested in leasing this space. Could you share the lease terms and availability?";

    document.getElementById("detail").innerHTML = `
      <div class="breadcrumb" style="margin-top:20px">
        <a href="index.html">Home</a> / <a href="listings.html?mode=${l.mode}">${m.label}</a> /
        <a href="listings.html?mode=${l.mode}&type=${l.type}">${t.plural}</a> /
        <a href="listings.html?mode=${l.mode}&q=${encodeURIComponent(l.city)}">${esc(l.city)}</a>
      </div>

      <div class="gallery n${Math.min(imgs.length, 5)}">
        ${imgs.slice(0, 5).map((src, i) => `
          <div class="g" data-i="${i}" data-icon="${t.icon}">
            <img src="${esc(src)}" alt="Photo ${i + 1}" onerror="pnImgFallback(this)">
            ${i === 4 && imgs.length > 5 ? `<div class="more">+${imgs.length - 5} photos</div>` : ""}
          </div>`).join("")}
      </div>

      <div class="detail-layout">
        <div>
          <div class="detail-head">
            <div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <span class="tag ${m.color}">${m.verb}</span>
                ${l.featured ? '<span class="tag featured">Featured</span>' : ""}
                ${l.verified ? `<span class="tag verified" style="border:1px solid var(--line)">${icon("check", 12)} Verified</span>` : ""}
              </div>
              <h1>${esc(l.title)}</h1>
              <div class="card-loc">${icon("pin", 16)} ${esc(l.area)}, ${esc(l.city)}, ${esc(l.province)}</div>
            </div>
            <div style="text-align:right">
              <div class="detail-price">${priceHtml(l)}</div>
              ${l.mode === "buy" && (l.floor || l.land) ? `<div class="muted" style="font-size:14px">${peso(l.price / (l.floor || l.land))} / sqm</div>` : ""}
              <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
                <button class="btn btn-outline btn-sm" id="share-btn">${icon("share", 16)} Share</button>
                <button class="btn btn-outline btn-sm" id="save-btn">${icon("heart", 16)} <span>${isFav(l.id) ? "Saved" : "Save"}</span></button>
              </div>
            </div>
          </div>

          <div class="key-facts">${factsHtml(l)}</div>

          <div class="panel">
            <h2>Description</h2>
            <p style="margin:0;color:var(--muted)">${esc(l.description)}</p>
          </div>

          <div class="panel">
            <h2>Amenities &amp; features</h2>
            <div class="amen">${l.amenities.map((a) => `<div>${icon("check", 18)} ${esc(a)}</div>`).join("")}</div>
          </div>

          <div class="panel">
            <h2>Property details</h2>
            <table class="spec-table">${specRows(l)}</table>
          </div>

          <div class="panel">
            <h2>Location</h2>
            <p class="muted" style="margin-top:-6px">${esc(l.area)}, ${esc(l.city)}. Pin shows the approximate area, not the exact address.</p>
            <a class="map-link" href="${mapUrl}" target="_blank" rel="noopener">
              <span class="map-pin">${icon("pin", 28)}</span>
              <span><strong>${esc(l.area)}, ${esc(l.city)}</strong><br><span class="muted">Open in OpenStreetMap ↗</span></span>
            </a>
          </div>
        </div>

        <aside>
          <div class="side-card">
            <div class="agent">
              <div class="avatar">${esc(initials)}</div>
              <div>
                <strong>${esc(l.agent.name)} ${l.agent.verified ? `<span style="color:var(--brand)" title="Verified agent">${icon("shield", 15)}</span>` : ""}</strong>
                <span>${esc(l.agent.agency)}</span>
              </div>
            </div>
            <h3 style="margin:4px 0 0;font-size:15px">${l.mode === "buy" ? "Payment estimate" : l.mode === "rent" ? "Move-in costs" : "Lease cost breakdown"}</h3>
            ${costBox(l)}
            <form id="enquiry" style="display:grid;gap:10px">
              <input class="input" name="name" placeholder="Your name" required>
              <input class="input" name="email" type="email" placeholder="Email" required>
              <input class="input" name="phone" placeholder="Mobile number (+63)">
              ${l.mode === "lease" ? '<input class="input" name="company" placeholder="Company name (optional)">' : ""}
              ${l.mode !== "buy" ? `<div class="field"><label>Preferred move-in date</label><input class="input" type="date" name="date"></div>` : ""}
              <textarea class="textarea" name="msg" rows="4">${enquiry}</textarea>
              <button class="btn btn-primary btn-block" type="submit">${icon("mail", 16)} Send enquiry</button>
            </form>
            <a class="btn btn-outline btn-block" href="tel:${l.agent.phone.replace(/\s/g, "")}" id="call-btn">${icon("phone", 16)} Show phone number</a>
          </div>
        </aside>
      </div>

      ${similar.length ? `
      <section style="padding-bottom:64px">
        <div class="section-head"><div><h2>Similar properties ${m.verb.toLowerCase()}</h2></div>
          <a class="link-more" href="listings.html?mode=${l.mode}&type=${l.type}">See more →</a></div>
        <div class="listing-grid">${similar.map(cardHtml).join("")}</div>
      </section>` : ""}`;

    bind(l);
    trackRecent(l.id);
  }

  function bind(l) {
    document.getElementById("save-btn").addEventListener("click", (e) => {
      const on = toggleFav(l.id);
      e.currentTarget.querySelector("span").textContent = on ? "Saved" : "Save";
      toast(on ? "Saved to your favorites" : "Removed from favorites");
    });
    document.getElementById("share-btn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        toast("Link copied to clipboard");
      } catch {
        toast("Couldn't copy automatically. Copy the link from your address bar.");
      }
    });
    const call = document.getElementById("call-btn");
    call.addEventListener("click", (e) => {
      if (!call.dataset.shown) {
        e.preventDefault();
        call.dataset.shown = "1";
        call.innerHTML = icon("phone", 16) + " " + esc(l.agent.phone);
      }
    });
    document.getElementById("enquiry").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      const sent = load("pn_enquiries", []);
      sent.push({ listing: l.id, at: new Date().toISOString(), ...data });
      save("pn_enquiries", sent);
      e.target.reset();
      toast(`Enquiry sent to ${l.agent.name}. They'll get back to you soon.`);
    });
    document.querySelectorAll(".gallery .g").forEach((g) => g.addEventListener("click", () => lightbox(l.images, +g.dataset.i)));
  }

  function lightbox(imgs, start) {
    let i = start;
    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `<img alt=""><button class="lb-close" aria-label="Close">✕</button>
      <button class="lb-prev" aria-label="Previous">‹</button><button class="lb-next" aria-label="Next">›</button>
      <div class="lb-count"></div>`;
    const show = () => { box.querySelector("img").src = imgs[i]; box.querySelector(".lb-count").textContent = `${i + 1} / ${imgs.length}`; };
    const close = () => { box.remove(); document.removeEventListener("keydown", key); };
    const step = (d) => { i = (i + d + imgs.length) % imgs.length; show(); };
    const key = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); };
    box.querySelector(".lb-close").onclick = close;
    box.querySelector(".lb-prev").onclick = () => step(-1);
    box.querySelector(".lb-next").onclick = () => step(1);
    box.addEventListener("click", (e) => e.target === box && close());
    document.addEventListener("keydown", key);
    document.body.appendChild(box);
    show();
  }

  function trackRecent(id) {
    const r = load("pn_recent", []).filter((x) => x !== id);
    r.unshift(id);
    save("pn_recent", r.slice(0, 12));
  }

  document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(location.search).get("id");
    const l = id && getListing(id);
    if (!l) {
      document.getElementById("detail").innerHTML = `<div class="empty" style="margin:60px 0">
        ${icon("search", 40)}<h3>Listing not found</h3><p>It may have been removed or the link is incorrect.</p>
        <a class="btn btn-outline" href="listings.html">Browse all properties</a></div>`;
      return;
    }
    render(l);
  });
})();
