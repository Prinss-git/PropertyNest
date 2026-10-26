(function () {
  const D = window.PN_DATA;
  const { esc, addUserListing, toast, load } = window.PN;

  const TYPES_FOR = {
    buy: ["condo", "house", "townhouse", "lot", "commercial"],
    rent: ["condo", "apartment", "house", "townhouse"],
    lease: ["office", "commercial", "warehouse", "house", "condo", "lot"]
  };
  const FALLBACK_IMG = { house: "house", townhouse: "house", condo: "condo", apartment: "condo", office: "office", commercial: "commercial", warehouse: "warehouse", lot: "lot" };
  let photos = [];

  const form = document.getElementById("post-form");
  const $ = (id) => document.getElementById(id);
  const mode = () => form.querySelector('input[name="mode"]:checked').value;

  function syncType() {
    const m = mode();
    const sel = $("p-type");
    const prev = sel.value;
    sel.innerHTML = TYPES_FOR[m].map((t) => `<option value="${t}">${D.TYPES[t].label}</option>`).join("");
    if (TYPES_FOR[m].includes(prev)) sel.value = prev;
    $("price-lbl").textContent = m === "buy" ? "Selling price (₱)" : m === "rent" ? "Monthly rent (₱)" : "Monthly lease rate (₱)";
    document.querySelectorAll("[data-terms]").forEach((g) => g.classList.toggle("hidden", g.dataset.terms !== m));
    syncFields();
  }

  function syncFields() {
    const t = $("p-type").value;
    const res = ["condo", "house", "apartment", "townhouse"].includes(t);
    document.querySelectorAll("[data-res]").forEach((el) => el.classList.toggle("hidden", !res));
    document.querySelectorAll("[data-notlot]").forEach((el) => el.classList.toggle("hidden", t === "lot"));
    $("p-furn").innerHTML = (res ? ["Fully Furnished", "Semi Furnished", "Unfurnished"] : t === "office" ? ["Fitted", "Warm Shell", "Bare Shell"] : ["N/A"])
      .map((f) => `<option>${f}</option>`).join("");
    const pool = t === "lot" ? D.AMENITIES.lot : res ? D.AMENITIES.residential : D.AMENITIES.commercial;
    $("p-amen").innerHTML = pool.map((a) => `<label class="check"><input type="checkbox" name="amenities" value="${esc(a)}"> ${esc(a)}</label>`).join("");
  }

  function syncCity() {
    const loc = D.LOCATIONS.find((l) => l.city === $("p-city").value);
    $("area-list").innerHTML = loc ? loc.areas.map((a) => `<option value="${esc(a)}">`).join("") : "";
  }

  // Downscale photos before storing so several fit within localStorage limits.
  function resize(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const im = new Image();
        im.onerror = reject;
        im.onload = () => {
          const scale = Math.min(1, 900 / Math.max(im.width, im.height));
          const c = document.createElement("canvas");
          c.width = Math.round(im.width * scale);
          c.height = Math.round(im.height * scale);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.72));
        };
        im.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPreview() {
    $("photo-preview").innerHTML = photos.map((p, i) => `
      <div style="position:relative;width:96px;height:72px;border-radius:8px;overflow:hidden">
        <img src="${p}" style="width:100%;height:100%;object-fit:cover" alt="">
        <button type="button" data-rm="${i}" style="position:absolute;top:2px;right:2px;border:0;border-radius:50%;width:22px;height:22px;background:rgba(0,0,0,.6);color:#fff;cursor:pointer">✕</button>
      </div>`).join("");
  }

  function init() {
    $("p-city").innerHTML = D.LOCATIONS.map((l) => `<option value="${esc(l.city)}">${esc(l.city)}, ${esc(l.province)}</option>`).join("");
    form.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", syncType));
    $("p-type").addEventListener("change", syncFields);
    $("p-city").addEventListener("change", syncCity);
    const preset = new URLSearchParams(location.search).get("mode");
    if (preset && TYPES_FOR[preset]) form.querySelector(`input[value="${preset}"]`).checked = true;
    syncType();
    syncCity();

    $("p-photos").addEventListener("change", async (e) => {
      const files = [...e.target.files].slice(0, 6 - photos.length);
      for (const f of files) {
        try { photos.push(await resize(f)); } catch { toast("Couldn't read " + f.name); }
      }
      e.target.value = "";
      renderPreview();
    });
    $("photo-preview").addEventListener("click", (e) => {
      const b = e.target.closest("[data-rm]");
      if (b) { photos.splice(+b.dataset.rm, 1); renderPreview(); }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const m = mode();
      const type = fd.get("type");
      const loc = D.LOCATIONS.find((l) => l.city === fd.get("city"));
      const num = (k) => Math.max(0, Number(fd.get(k)) || 0);
      const res = ["condo", "house", "apartment", "townhouse"].includes(type);
      const userCount = load("pn_user_listings", []).length;

      const l = {
        id: "PN-U" + Date.now().toString(36).toUpperCase(),
        mode: m, type,
        title: fd.get("title").trim(),
        price: num("price"),
        city: loc.city, province: loc.province, area: fd.get("area").trim(),
        lat: loc.lat, lng: loc.lng,
        beds: res ? num("beds") : 0,
        baths: type === "lot" ? 0 : num("baths"),
        floor: type === "lot" ? 0 : num("floor"),
        land: num("land"),
        parking: type === "lot" ? 0 : num("parking"),
        furnishing: fd.get("furnishing") || "N/A",
        amenities: fd.getAll("amenities"),
        images: photos.length ? photos : [D.img(D.IMAGES[FALLBACK_IMG[type]][userCount % D.IMAGES[FALLBACK_IMG[type]].length])],
        agent: { name: fd.get("agentName").trim(), agency: fd.get("agency").trim() || "Owner", phone: fd.get("phone").trim(), verified: false },
        posted: new Date().toISOString().slice(0, 10),
        featured: false,
        verified: false,
        description: fd.get("description").trim()
      };
      if (m === "buy") { l.titleStatus = fd.get("titleStatus"); l.financing = fd.getAll("financing"); }
      if (m === "rent") { l.deposit = num("rDeposit"); l.advance = num("rAdvance"); l.minStay = Math.max(1, num("minStay")); l.petFriendly = fd.get("petFriendly") === "on"; }
      if (m === "lease") { l.minTerm = Math.max(1, num("minTerm")); l.escalation = num("escalation"); l.cusa = num("cusa"); l.deposit = num("lDeposit"); l.advance = num("lAdvance"); }

      try {
        addUserListing(l);
        if (!load("pn_user_listings", []).some((x) => x.id === l.id)) throw new Error("not saved");
      } catch {
        toast("Couldn't save: browser storage is full or blocked. Try fewer photos.");
        return;
      }
      location.href = "property.html?id=" + encodeURIComponent(l.id);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
