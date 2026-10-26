/* PropertyNest sample data.
 * Listings are generated from a seeded PRNG so IDs and details are stable across page loads.
 * User-posted listings (from post.html) are stored in localStorage and merged in by app.js.
 */
(function () {
  const MODES = {
    buy:   { label: "Buy",   verb: "For Sale",  priceUnit: "",        color: "buy" },
    rent:  { label: "Rent",  verb: "For Rent",  priceUnit: "/month",  color: "rent" },
    lease: { label: "Lease", verb: "For Lease", priceUnit: "/month",  color: "lease" }
  };

  const TYPES = {
    condo:      { label: "Condominium", plural: "Condos",       icon: "building" },
    house:      { label: "House & Lot", plural: "Houses",       icon: "house" },
    apartment:  { label: "Apartment",   plural: "Apartments",   icon: "apartment" },
    townhouse:  { label: "Townhouse",   plural: "Townhouses",   icon: "townhouse" },
    lot:        { label: "Lot",         plural: "Lots",         icon: "lot" },
    commercial: { label: "Commercial",  plural: "Commercial",   icon: "store" },
    office:     { label: "Office Space",plural: "Offices",      icon: "office" },
    warehouse:  { label: "Warehouse",   plural: "Warehouses",   icon: "warehouse" }
  };

  const LOCATIONS = [
    { city: "Makati",        province: "Metro Manila", areas: ["Salcedo Village", "Legazpi Village", "Poblacion", "Rockwell", "San Lorenzo"], lat: 14.5547, lng: 121.0244, factor: 1.45 },
    { city: "Taguig",        province: "Metro Manila", areas: ["BGC", "McKinley Hill", "Uptown Bonifacio", "Arca South", "Fort Bonifacio"], lat: 14.5176, lng: 121.0509, factor: 1.5 },
    { city: "Quezon City",   province: "Metro Manila", areas: ["Diliman", "Cubao", "Eastwood", "New Manila", "Teachers Village"], lat: 14.6760, lng: 121.0437, factor: 1.05 },
    { city: "Pasig",         province: "Metro Manila", areas: ["Ortigas Center", "Kapitolyo", "Capitol Commons", "San Antonio", "Ugong"], lat: 14.5764, lng: 121.0851, factor: 1.15 },
    { city: "Mandaluyong",   province: "Metro Manila", areas: ["Greenfield District", "Wack-Wack", "Shaw Blvd", "Highway Hills"], lat: 14.5794, lng: 121.0359, factor: 1.1 },
    { city: "Parañaque",     province: "Metro Manila", areas: ["BF Homes", "Entertainment City", "Sucat", "Don Bosco"], lat: 14.4793, lng: 121.0198, factor: 0.95 },
    { city: "Manila",        province: "Metro Manila", areas: ["Malate", "Ermita", "Sampaloc", "Binondo", "Sta. Mesa"], lat: 14.5995, lng: 120.9842, factor: 0.9 },
    { city: "Cebu City",     province: "Cebu",         areas: ["IT Park", "Cebu Business Park", "Lahug", "Banilad", "Talamban"], lat: 10.3157, lng: 123.8854, factor: 0.95 },
    { city: "Davao City",    province: "Davao del Sur",areas: ["Lanang", "Matina", "Buhangin", "Poblacion", "Ecoland"], lat: 7.1907, lng: 125.4553, factor: 0.75 },
    { city: "Bacoor",        province: "Cavite",       areas: ["Molino", "Talaba", "Niog", "Habay"], lat: 14.4590, lng: 120.9290, factor: 0.6 },
    { city: "Santa Rosa",    province: "Laguna",       areas: ["Nuvali", "Balibago", "Tagapo", "Don Jose"], lat: 14.3122, lng: 121.1114, factor: 0.7 },
    { city: "Angeles",       province: "Pampanga",     areas: ["Balibago", "Clark", "Pampang", "Malabanias"], lat: 15.1450, lng: 120.5887, factor: 0.6 },
    { city: "Baguio",        province: "Benguet",      areas: ["Camp John Hay", "Session Road", "Outlook Drive", "Pacdal"], lat: 16.4023, lng: 120.5960, factor: 0.85 },
    { city: "Iloilo City",   province: "Iloilo",       areas: ["Mandurriao", "Jaro", "Iloilo Business Park", "Molo"], lat: 10.7202, lng: 122.5621, factor: 0.65 }
  ];

  // Photos are bundled locally in img/ (originally from Unsplash) so the site works offline and on hosts that block external images.
  const IMAGES = {
    house: ["1600596542815-ffad4c1539a9", "1600585154340-be6161a56a0c", "1564013799919-ab600027ffc6", "1570129477492-45c003edd2be", "1568605114967-8130f3a36994", "1580587771525-78b9dba3b914", "1613490493576-7fde63acd811", "1512917774080-9991f1c4c750"],
    condo: ["1545324418-cc1a3fa10c00", "1502672260266-1c1ef2d93688", "1522708323590-d24dbb6b0267", "1560448204-e02f11c3d0e2", "1493809842364-78817add7ffb", "1586023492125-27b2c045efd7"],
    interior: ["1502672260266-1c1ef2d93688", "1522708323590-d24dbb6b0267", "1560448204-e02f11c3d0e2", "1493809842364-78817add7ffb", "1586023492125-27b2c045efd7", "1600210492486-724fe5c67fb0", "1600566753190-17f0baa2a6c3", "1484154218962-a197022b5858"],
    office: ["1497366216548-37526070297c", "1497366811353-6870744d04b2", "1486406146926-c627a92ad1ab", "1504384308090-c894fdcc538d", "1497215728101-856f4ea42174"],
    commercial: ["1441986300917-64674bd600d8", "1555396273-367ea4eb4db5", "1567401893414-76b7b1e5a7a5", "1604719312566-8912e9227c6a"],
    lot: ["1500382017468-9049fed747ef", "1449844908441-8829872d2607", "1501785888041-af3ef285b470", "1464822759023-fed622ff2c3b"],
    warehouse: ["1586528116311-ad8dd3c8310d", "1553413077-190dd305871c", "1565610222536-ef125c59da2e"]
  };
  const img = (id) => "img/" + id + ".jpg";

  const AMENITIES = {
    residential: ["Swimming Pool", "Gym", "24/7 Security", "Parking", "Balcony", "Garden", "Clubhouse", "Playground", "Elevator", "Laundry Area", "Pet Friendly", "CCTV", "Function Room", "Jogging Path", "Backup Generator", "Fiber Internet Ready"],
    commercial: ["24/7 Access", "Parking", "Backup Generator", "Central Aircon", "Elevator", "CCTV", "Loading Bay", "Fire Sprinkler", "PEZA Accredited", "High Ceiling", "Fiber Internet", "Security Guard"],
    lot: ["Gated Community", "Road Access", "Electricity Available", "Water Line", "Titled", "Corner Lot", "Flat Terrain", "Near Highway"]
  };

  const AGENTS = [
    { name: "Maria Santos",      agency: "Nest Realty Partners",     phone: "+63 917 555 0142", verified: true },
    { name: "Joaquin Reyes",     agency: "Metro Prime Properties",   phone: "+63 918 555 0187", verified: true },
    { name: "Andrea Villanueva", agency: "Island Homes PH",          phone: "+63 927 555 0123", verified: false },
    { name: "Carlo Mendoza",     agency: "Mendoza & Co. Realty",     phone: "+63 945 555 0199", verified: true },
    { name: "Bea Lim",           agency: "Visayas Property Hub",     phone: "+63 932 555 0164", verified: true },
    { name: "Paolo Garcia",      agency: "Mindanao Land Corp",       phone: "+63 908 555 0110", verified: false },
    { name: "Kristine Tan",      agency: "CBD Commercial Leasing",   phone: "+63 917 555 0178", verified: true },
    { name: "Miguel dela Cruz",  agency: "Independent Broker",       phone: "+63 919 555 0135", verified: false }
  ];

  // mulberry32
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const r = rng(20261026);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const between = (a, b) => a + r() * (b - a);
  const int = (a, b) => Math.floor(between(a, b + 1));
  const roundTo = (n, step) => Math.round(n / step) * step;
  function sample(arr, n) {
    const copy = arr.slice(), out = [];
    while (out.length < n && copy.length) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
    return out;
  }

  // Which property types make sense for each mode, weighted by repetition.
  const MODE_TYPES = {
    buy:   ["condo", "condo", "house", "house", "house", "townhouse", "lot", "lot", "commercial"],
    rent:  ["condo", "condo", "condo", "apartment", "apartment", "house", "townhouse"],
    lease: ["office", "office", "office", "commercial", "commercial", "warehouse", "warehouse", "house", "condo", "lot"]
  };

  // Base prices in PHP (buy = total, rent/lease = monthly), multiplied by location factor.
  const BASE = {
    buy:   { condo: [3.5e6, 22e6], house: [6e6, 65e6], townhouse: [4.5e6, 18e6], lot: [1.8e6, 40e6], commercial: [15e6, 120e6] },
    rent:  { condo: [16000, 120000], apartment: [9000, 35000], house: [35000, 250000], townhouse: [25000, 75000] },
    lease: { office: [60000, 900000], commercial: [45000, 600000], warehouse: [120000, 1500000], house: [60000, 300000], condo: [35000, 150000], lot: [50000, 400000] }
  };

  const TITLE_WORDS = {
    condo: ["Studio Unit", "1BR Condo", "2BR Corner Unit", "3BR Penthouse", "Loft-Type Unit", "1BR with Balcony"],
    house: ["Modern House & Lot", "Single-Detached Home", "Contemporary Family Home", "Bungalow with Garden", "Elegant 2-Storey House", "Resort-Style Villa"],
    apartment: ["Apartment Unit", "Studio Apartment", "2BR Apartment", "Garden Apartment", "Walk-up Apartment"],
    townhouse: ["3-Storey Townhouse", "Brand-New Townhouse", "Corner Townhouse", "Townhouse in Gated Subd."],
    lot: ["Residential Lot", "Prime Commercial Lot", "Corner Lot", "Overlooking Lot", "Lot near Main Road"],
    commercial: ["Retail Space", "Ground-Floor Commercial Unit", "Restaurant Space", "Commercial Building", "Kiosk & Retail Space"],
    office: ["Fitted Office Space", "Bare Shell Office Floor", "PEZA Office Space", "Grade-A Office Unit", "Whole Floor Office"],
    warehouse: ["Warehouse with Office", "Industrial Warehouse", "Cold Storage Facility", "Logistics Warehouse"]
  };

  function imagesFor(type) {
    if (type === "house" || type === "townhouse") return [pick(IMAGES.house), ...sample(IMAGES.interior, 4)];
    if (type === "condo" || type === "apartment") return [pick(IMAGES.condo), ...sample(IMAGES.interior, 4)];
    if (type === "office") return sample(IMAGES.office, 4);
    if (type === "commercial") return sample(IMAGES.commercial, 3).concat(pick(IMAGES.office));
    if (type === "warehouse") return sample(IMAGES.warehouse, 3);
    return sample(IMAGES.lot, 3);
  }

  function makeListing(i, mode) {
    const type = pick(MODE_TYPES[mode]);
    const loc = pick(LOCATIONS);
    const area = pick(loc.areas);
    const residential = ["condo", "house", "apartment", "townhouse"].includes(type);
    const [lo, hi] = BASE[mode][type];
    const raw = between(lo, hi) * loc.factor;
    const price = mode === "buy" ? roundTo(raw, 50000) : roundTo(raw, 500);

    let beds = 0, baths = 0, floor = 0, land = 0;
    if (type === "condo") { beds = pick([0, 1, 1, 2, 2, 3]); baths = Math.max(1, beds); floor = beds === 0 ? int(22, 32) : int(35 + beds * 12, 60 + beds * 35); }
    else if (type === "apartment") { beds = pick([0, 1, 2, 2, 3]); baths = Math.max(1, beds - 1); floor = int(20, 75); }
    else if (type === "house") { beds = int(3, 6); baths = beds - int(0, 1); floor = int(150, 520); land = int(150, 800); }
    else if (type === "townhouse") { beds = int(2, 4); baths = beds; floor = int(90, 180); land = int(50, 110); }
    else if (type === "lot") { land = roundTo(between(120, 5000), 10); }
    else if (type === "office") { floor = roundTo(between(60, 2400), 5); baths = int(1, 4); }
    else if (type === "commercial") { floor = roundTo(between(25, 600), 5); baths = int(1, 2); }
    else if (type === "warehouse") { floor = roundTo(between(500, 6000), 50); land = roundTo(floor * between(1.2, 2), 50); baths = int(1, 3); }

    const titleBase = pick(TITLE_WORDS[type]);
    const title = `${titleBase} ${MODES[mode].verb.toLowerCase()} in ${area}, ${loc.city}`;
    const furnishing = residential ? pick(["Fully Furnished", "Semi Furnished", "Unfurnished"]) : (type === "office" ? pick(["Fitted", "Bare Shell", "Warm Shell"]) : "N/A");
    const amenPool = residential ? AMENITIES.residential : (type === "lot" ? AMENITIES.lot : AMENITIES.commercial);
    const agent = pick(AGENTS);
    const daysAgo = int(0, 60);
    const posted = new Date(Date.UTC(2026, 9, 26) - daysAgo * 864e5).toISOString().slice(0, 10);

    const listing = {
      id: "PN-" + (10000 + i),
      mode, type, title,
      price,
      city: loc.city, province: loc.province, area,
      lat: loc.lat + between(-0.015, 0.015), lng: loc.lng + between(-0.015, 0.015),
      beds, baths, floor, land,
      parking: type === "lot" ? 0 : int(0, type === "house" ? 3 : 2),
      furnishing,
      amenities: sample(amenPool, int(4, 8)),
      images: imagesFor(type).map(img),
      agent,
      posted,
      featured: r() < 0.22,
      verified: agent.verified && r() < 0.85,
      description: ""
    };

    if (mode === "rent") {
      listing.deposit = pick([1, 2, 2]);       // months
      listing.advance = 1;                      // months
      listing.minStay = pick([6, 12, 12]);      // months
      listing.petFriendly = r() < 0.4;
    }
    if (mode === "lease") {
      listing.minTerm = pick([1, 2, 3, 3, 5]);  // years
      listing.escalation = pick([5, 5, 7, 10]); // % per year
      listing.deposit = pick([3, 3, 6]);
      listing.advance = pick([3, 3, 6]);
      listing.cusa = type === "office" || type === "commercial" ? roundTo(between(90, 250), 5) : 0; // PHP per sqm
    }
    if (mode === "buy") {
      listing.titleStatus = pick(["Clean Title", "Clean Title", "Pre-selling", "RFO (Ready for Occupancy)"]);
      listing.financing = sample(["Bank Financing", "Pag-IBIG", "In-house Financing", "Cash"], int(2, 4));
    }

    listing.description = describe(listing);
    return listing;
  }

  function describe(l) {
    const t = TYPES[l.type].label.toLowerCase();
    const parts = [];
    if (l.mode === "buy") parts.push(`Own this ${t} in ${l.area}, ${l.city}. ${l.titleStatus}.`);
    if (l.mode === "rent") parts.push(`A ${l.furnishing.toLowerCase()} ${t} for rent in ${l.area}, ${l.city}, available for move-in. Minimum stay of ${l.minStay} months.`);
    if (l.mode === "lease") parts.push(`Long-term lease opportunity: ${t} in ${l.area}, ${l.city}. Minimum lease term of ${l.minTerm} year${l.minTerm > 1 ? "s" : ""} with ${l.escalation}% annual escalation.`);
    if (l.beds) parts.push(`It has ${l.beds} bedroom${l.beds > 1 ? "s" : ""} and ${l.baths} bathroom${l.baths > 1 ? "s" : ""}.`);
    if (l.floor) parts.push(`Floor area is ${l.floor.toLocaleString()} sqm${l.land ? ` on a ${l.land.toLocaleString()} sqm lot` : ""}.`);
    else if (l.land) parts.push(`Lot area is ${l.land.toLocaleString()} sqm.`);
    parts.push(`Amenities and features include ${l.amenities.slice(0, 4).join(", ").toLowerCase()}. It is close to schools, malls, hospitals, and major roads.`);
    parts.push(`Contact ${l.agent.name} of ${l.agent.agency} to schedule a viewing.`);
    return parts.join(" ");
  }

  const LISTINGS = [];
  let n = 0;
  [["buy", 44], ["rent", 40], ["lease", 36]].forEach(([mode, count]) => {
    for (let k = 0; k < count; k++) LISTINGS.push(makeListing(n++, mode));
  });

  window.PN_DATA = { MODES, TYPES, LOCATIONS, AMENITIES, AGENTS, IMAGES, LISTINGS, img };
})();
