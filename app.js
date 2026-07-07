/* ============================================================
   A to Zero — shopping simulator
   All state lives in localStorage. No network calls, no accounts,
   no payments. The point is the ritual, not the receipt.
   ============================================================ */

const LS_KEY = "a2z-state-v1";

/* ---------- delivery speed options (ms) ---------- */
const SHIPPING_OPTIONS = [
  { id: "standard", label: "FREE Standard Delivery", eta: "arrives in about 4 hours", duration: 4 * 60 * 60 * 1000 },
  { id: "express",  label: "FREE Express Delivery",  eta: "arrives in about 30 minutes", duration: 30 * 60 * 1000 },
  { id: "instantish", label: "FREE Almost-Instant Delivery", eta: "arrives in about 2 minutes", duration: 2 * 60 * 1000 },
];

/* Delivery lifecycle milestones as fraction of total duration */
const MILESTONES = [
  { at: 0.00, key: "ordered",   label: "Order placed",              icon: "🧾", detail: "We received your order and did a little celebration dance." },
  { at: 0.08, key: "packed",    label: "Package is being prepared", icon: "📦", detail: "An imaginary employee is lovingly bubble-wrapping your item." },
  { at: 0.30, key: "shipped",   label: "Shipped",                   icon: "🚚", detail: "Your package left our fictional fulfillment center." },
  { at: 0.55, key: "hub",       label: "Arrived at local hub",      icon: "🏭", detail: "It's in your city now, resting briefly on a conveyor belt." },
  { at: 0.75, key: "outfor",    label: "Out for delivery",          icon: "🛵", detail: "It's on the truck! The driver is 9 pretend stops away." },
  { at: 1.00, key: "delivered", label: "Delivered",                 icon: "🏡", detail: "Your package has arrived. Go open it in My Stuff!" },
];

/* ---------- catalog: live real products, built-in fallback ---------- */
/* The live catalog comes from DummyJSON (https://dummyjson.com) — ~200 real
   products with real photos, no API key. It's fetched client-side in YOUR
   browser and cached locally; when unreachable, the built-in catalog loads. */
let PRODUCTS = BUILTIN_PRODUCTS;
let CATEGORIES = BUILTIN_CATEGORIES;

const CATALOG_CACHE_KEY = "a2z-live-catalog-v2";

const CAT_META = {
  "beauty":              { name: "Beauty", emoji: "💄" },
  "fragrances":          { name: "Fragrances", emoji: "🌸" },
  "furniture":           { name: "Furniture", emoji: "🛋️" },
  "groceries":           { name: "Groceries", emoji: "🛒" },
  "home-decoration":     { name: "Home Decoration", emoji: "🖼️" },
  "kitchen-accessories": { name: "Kitchen", emoji: "🍳" },
  "laptops":             { name: "Laptops", emoji: "💻" },
  "mens-shirts":         { name: "Men's Shirts", emoji: "👔" },
  "mens-shoes":          { name: "Men's Shoes", emoji: "👞" },
  "mens-watches":        { name: "Men's Watches", emoji: "⌚" },
  "mobile-accessories":  { name: "Mobile Accessories", emoji: "🔌" },
  "motorcycle":          { name: "Motorcycle", emoji: "🏍️" },
  "skin-care":           { name: "Skin Care", emoji: "🧴" },
  "smartphones":         { name: "Smartphones", emoji: "📱" },
  "sports-accessories":  { name: "Sports", emoji: "🏀" },
  "sunglasses":          { name: "Sunglasses", emoji: "🕶️" },
  "tablets":             { name: "Tablets", emoji: "📲" },
  "tops":                { name: "Tops", emoji: "👚" },
  "vehicle":             { name: "Vehicles", emoji: "🚗" },
  "womens-bags":         { name: "Women's Bags", emoji: "👜" },
  "womens-dresses":      { name: "Women's Dresses", emoji: "👗" },
  "womens-jewellery":    { name: "Women's Jewellery", emoji: "💍" },
  "womens-shoes":        { name: "Women's Shoes", emoji: "👠" },
  "womens-watches":      { name: "Women's Watches", emoji: "⌚" },
};
const catMeta = (id) => CAT_META[id] || {
  name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  emoji: "🛍️",
};

/* Deterministic pseudo-numbers from a string (stable fake prices/ratings
   for sources that don't publish prices) */
function hashNum(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

function mapDummyJson(d) {
  return {
    id: "d" + d.id,
    cat: d.category,
    store: "A2Z Warehouse",
    emoji: catMeta(d.category).emoji,
    img: d.thumbnail || (d.images && d.images[0]) || null,
    name: d.brand && !d.title.toLowerCase().includes(d.brand.toLowerCase())
      ? `${d.brand} ${d.title}` : d.title,
    price: d.price,
    was: d.discountPercentage > 1 ? +(d.price / (1 - d.discountPercentage / 100)).toFixed(2) : null,
    rating: d.rating || 4,
    reviews: 500 + (d.id * 7919) % 48000, // deterministic pretend crowd
    prime: (d.rating || 0) >= 4,
    blurb: d.description || "",
    bullets: [
      d.brand ? `Brand: ${d.brand}` : null,
      d.warrantyInformation ? `Warranty: ${d.warrantyInformation}` : null,
      d.shippingInformation ? `Shipping: ${d.shippingInformation}` : null,
      d.returnPolicy ? `Returns: ${d.returnPolicy}` : null,
      d.availabilityStatus ? `Availability: ${d.availabilityStatus}` : null,
    ].filter(Boolean),
  };
}

/* Open Food Facts / Open Beauty Facts: real brand-name products with real
   photos, but no prices — so we invent stable, plausible ones. */
function mapOpenFacts(d, { idPrefix, cat, store, priceMin, priceMax }) {
  const name = [d.brands ? d.brands.split(",")[0].trim() : "", d.product_name || ""].filter(Boolean).join(" ").trim();
  if (!name || !d.image_front_url) return null;
  const h = hashNum(String(d.code));
  const price = +(priceMin + (h % Math.round((priceMax - priceMin) * 100)) / 100).toFixed(2);
  const rating = +(3.7 + (h % 13) / 10).toFixed(1);
  return {
    id: idPrefix + d.code,
    cat,
    store,
    emoji: catMeta(cat).emoji,
    img: d.image_front_url,
    name: d.quantity ? `${name}, ${d.quantity}` : name,
    price,
    was: h % 3 === 0 ? +(price * 1.25).toFixed(2) : null,
    rating,
    reviews: 100 + h % 9000,
    prime: rating >= 4.1,
    blurb: "A real product from the Open " + (idPrefix === "off" ? "Food" : "Beauty") + " Facts community database. The price is invented (nothing here is for sale) — the product is not.",
    bullets: [
      d.brands ? `Brand: ${d.brands.split(",")[0].trim()}` : null,
      d.quantity ? `Size: ${d.quantity}` : null,
      d.nutriscore_grade && d.nutriscore_grade.match(/^[a-e]$/) ? `Nutri-Score: ${d.nutriscore_grade.toUpperCase()}` : null,
      "Data: Open " + (idPrefix === "off" ? "Food" : "Beauty") + " Facts (openfoodfacts.org)",
    ].filter(Boolean),
  };
}

/* Each source loads independently — whatever responds gets merged in. */
const OFF_FIELDS = "code,product_name,brands,image_front_url,quantity,nutriscore_grade";
const CATALOG_SOURCES = [
  {
    name: "A2Z Warehouse (DummyJSON)",
    url: "https://dummyjson.com/products?limit=0",
    map: (data) => (data.products || []).map(mapDummyJson),
  },
  {
    name: "Real groceries (Open Food Facts)",
    url: `https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1&page_size=150&sort_by=unique_scans_n&fields=${OFF_FIELDS}`,
    map: (data) => (data.products || [])
      .map((d) => mapOpenFacts(d, { idPrefix: "off", cat: "groceries", store: "World Pantry", priceMin: 0.99, priceMax: 12.99 })),
  },
  {
    name: "Real beauty products (Open Beauty Facts)",
    url: `https://world.openbeautyfacts.org/cgi/search.pl?action=process&json=1&page_size=100&sort_by=unique_scans_n&fields=${OFF_FIELDS}`,
    map: (data) => (data.products || [])
      .map((d) => mapOpenFacts(d, { idPrefix: "obf", cat: "beauty", store: "Glow District", priceMin: 3.99, priceMax: 39.99 })),
  },
];

/* "My Finds" — products the user personally clipped from real stores */
const MY_FINDS_CAT = { id: "my-finds", name: "My Finds", emoji: "⭐" };
let catalogBase = { products: BUILTIN_PRODUCTS, categories: BUILTIN_CATEGORIES };

function useCatalog(products, categories) {
  catalogBase = { products, categories };
  const custom = (state && state.custom) || [];
  PRODUCTS = [...custom, ...products];
  CATEGORIES = custom.length ? [MY_FINDS_CAT, ...categories] : categories;
  buildCategoryUI();
  render();
}

async function loadLiveCatalog() {
  // Instant paint from the local cache, then refresh from the network.
  let hasCatalog = false;
  try {
    const cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY));
    if (cached && cached.products && cached.products.length) {
      useCatalog(cached.products, cached.categories);
      hasCatalog = true;
    }
  } catch (e) { /* bad cache — ignore */ }

  const results = await Promise.allSettled(
    CATALOG_SOURCES.map(async (src) => {
      const res = await fetch(src.url);
      if (!res.ok) throw new Error(src.name + ": HTTP " + res.status);
      return src.map(await res.json()).filter(Boolean);
    })
  );
  const products = results.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
  const failed = results.filter((r) => r.status === "rejected").length;

  if (products.length) {
    const categories = [...new Set(products.map((p) => p.cat))]
      .map((id) => ({ id, name: catMeta(id).name, emoji: catMeta(id).emoji }));
    try {
      localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ products, categories, at: Date.now() }));
    } catch (e) { /* storage full — still usable this session */ }
    useCatalog(products, categories);
    if (!hasCatalog) {
      showToast(`🛍️ Loaded ${products.length.toLocaleString()} real products from ${results.length - failed} source${results.length - failed === 1 ? "" : "s"}.`);
    }
  } else if (!hasCatalog) {
    showToast("📴 Product APIs unreachable — using the built-in demo catalog.");
  }
}

/* ---------- state ---------- */
let state = loadState();
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (!s.custom) s.custom = []; // migrate pre-My-Finds saves
      return s;
    }
  } catch (e) { /* corrupted state — start fresh */ }
  return { cart: {}, orders: [], stuff: [], saved: 0, notified: {}, custom: [] };
}
function saveState() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const money = (n) => "$" + n.toFixed(2);
const productById = (id) => PRODUCTS.find((p) => p.id === id);
const catById = (id) => CATEGORIES.find((c) => c.id === id);

/* Product art: real photo when we have one, emoji otherwise */
function prodArt(p, cls = "emoji-art") {
  return p.img
    ? `<img class="prod-photo" src="${esc(p.img)}" alt="" loading="lazy">`
    : `<span class="${cls}">${p.emoji}</span>`;
}

/* Resolve an order/stuff line to something renderable, even if the
   catalog changed since purchase (falls back to the stored snapshot). */
function lineInfo(line) {
  return productById(line.id) ||
    { id: line.id, emoji: line.emoji || "📦", img: line.img || null, name: line.name || "A mystery item", price: line.price };
}

function stars(rating) {
  const full = Math.round(rating);
  return `<span class="stars" title="${rating} out of 5">${"★".repeat(full)}${"☆".repeat(5 - full)}</span>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function orderNumber() {
  // Deterministic-ish fun order number
  const n = state.orders.length + 1;
  return `AZ0-${String(100000 + n * 7919).slice(-6)}-${String(1000000 + n * 104729).slice(-7)}`;
}

/* ---------- toast & confetti ---------- */
let toastTimer = null;
function showToast(msg) {
  const t = $("#toast");
  t.innerHTML = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

function confetti() {
  const canvas = $("#confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = "block";
  const colors = ["#ff9900", "#146eb4", "#e91e63", "#4caf50", "#ffc107", "#9c27b0"];
  const parts = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    r: 4 + Math.random() * 6,
    c: colors[Math.floor(Math.random() * colors.length)],
    vy: 2 + Math.random() * 3.5,
    vx: -1.5 + Math.random() * 3,
    rot: Math.random() * Math.PI,
    vr: -0.1 + Math.random() * 0.2,
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    });
    frames++;
    if (frames < 240) requestAnimationFrame(tick);
    else canvas.style.display = "none";
  })();
}

/* ---------- cart ---------- */
function cartItems() {
  return Object.entries(state.cart).map(([id, qty]) => ({ product: productById(id), qty })).filter((i) => i.product);
}
function cartCount() { return Object.values(state.cart).reduce((a, b) => a + b, 0); }
function cartTotal() { return cartItems().reduce((sum, i) => sum + i.product.price * i.qty, 0); }

function addToCart(id, qty = 1) {
  state.cart[id] = (state.cart[id] || 0) + qty;
  saveState();
  updateHeader();
  showToast(`✅ Added to cart — <strong>${esc(productById(id).name.split("—")[0].trim())}</strong>`);
}
function setCartQty(id, qty) {
  if (qty <= 0) delete state.cart[id];
  else state.cart[id] = qty;
  saveState();
  updateHeader();
  render();
}

/* ---------- orders & delivery simulation ---------- */
function placeOrder(shippingId) {
  const items = cartItems();
  if (!items.length) return;
  const shipping = SHIPPING_OPTIONS.find((s) => s.id === shippingId) || SHIPPING_OPTIONS[0];
  const total = cartTotal();
  const order = {
    id: "o" + Date.now(),
    number: orderNumber(),
    placedAt: Date.now(),
    duration: shipping.duration,
    shippingLabel: shipping.label,
    items: items.map((i) => ({
      id: i.product.id, qty: i.qty, price: i.product.price,
      // snapshot for rendering even if the live catalog changes later
      name: i.product.name, emoji: i.product.emoji, img: i.product.img || null,
    })),
    total,
    opened: false,
  };
  state.orders.unshift(order);
  state.saved += total;
  state.cart = {};
  saveState();
  updateHeader();
  location.hash = `#/thankyou/${order.id}`;
  confetti();
}

function orderProgress(order) {
  return Math.min(1, (Date.now() - order.placedAt) / order.duration);
}
function orderMilestone(order) {
  const p = orderProgress(order);
  let current = MILESTONES[0];
  for (const m of MILESTONES) if (p >= m.at) current = m;
  return current;
}
function orderEtaText(order) {
  const remaining = order.placedAt + order.duration - Date.now();
  if (remaining <= 0) return "Delivered";
  const mins = Math.ceil(remaining / 60000);
  if (mins < 60) return `Arriving in about ${mins} minute${mins === 1 ? "" : "s"}`;
  const hrs = Math.floor(mins / 60);
  return `Arriving in about ${hrs}h ${mins % 60}m`;
}

/* Watch for deliveries and toast when one lands */
setInterval(() => {
  let changed = false;
  for (const order of state.orders) {
    if (orderProgress(order) >= 1 && !state.notified[order.id]) {
      state.notified[order.id] = true;
      changed = true;
      showToast(`📦 <strong>Your package was delivered!</strong> Order ${esc(order.number)} is waiting in <a href="#/orders">Your Orders</a>.`);
      confetti();
    }
  }
  if (changed) saveState();
  // live-refresh tracking views
  if (location.hash.startsWith("#/track/") || location.hash === "#/orders") render();
}, 5000);

/* ---------- header ---------- */
function updateHeader() {
  $("#cart-count").textContent = cartCount();
  $("#savings-amount").textContent = money(state.saved);
}

function buildCategoryUI() {
  const sel = $("#search-category");
  sel.innerHTML = `<option value="">All</option>`;
  CATEGORIES.forEach((c) => {
    const o = document.createElement("option");
    o.value = c.id; o.textContent = c.name;
    sel.appendChild(o);
  });
  $("#category-strip").innerHTML =
    `<a href="#/" class="strip-link">🏠 Home</a>` +
    CATEGORIES.map((c) => `<a href="#/category/${c.id}" class="strip-link">${c.emoji} ${esc(c.name)}</a>`).join("") +
    `<a href="#/orders" class="strip-link">🚚 Track Orders</a>` +
    `<a href="#/add" class="strip-link">➕ Add Any Product</a>`;
}

function buildHeaderStatics() {
  buildCategoryUI();
  const doSearch = () => {
    const q = $("#search-input").value.trim();
    const cat = $("#search-category").value;
    location.hash = `#/search/${encodeURIComponent(q)}${cat ? "?cat=" + cat : ""}`;
  };
  $("#search-btn").addEventListener("click", doSearch);
  $("#search-input").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
}

/* ---------- views ---------- */
function productCard(p) {
  return `
  <div class="card">
    <a class="card-img" href="#/product/${p.id}">${prodArt(p)}</a>
    <div class="card-body">
      <a class="card-title" href="#/product/${p.id}">${esc(p.name)}</a>
      <div class="card-rating">${stars(p.rating)} <span class="review-count">${p.reviews.toLocaleString()}</span></div>
      <div class="card-price">
        <span class="price">${money(p.price)}</span>
        ${p.was ? `<span class="was">${money(p.was)}</span>` : ""}
      </div>
      ${p.prime ? `<div class="prime-badge">✓ zero<span>prime</span> FREE pretend delivery</div>` : `<div class="prime-badge none">FREE pretend delivery</div>`}
      <button class="btn btn-cart" onclick="addToCart('${p.id}')">Add to Cart</button>
    </div>
  </div>`;
}

function viewHome() {
  const deals = [...PRODUCTS].filter((p) => p.was).sort((a, b) => (b.was - b.price) / b.was - (a.was - a.price) / a.was).slice(0, 4);
  return `
  <div class="hero">
    <div class="hero-inner">
      <h1>Shop everything. Spend <em>zero</em>.</h1>
      <p>The full shopping experience — browsing, buying, tracking, unboxing — with none of the money leaving your pocket. You've already kept <strong>${money(state.saved)}</strong> where it belongs.</p>
    </div>
  </div>
  <section class="section">
    <h2>🔥 Today's Pretend Deals</h2>
    <div class="grid">${deals.map(productCard).join("")}</div>
  </section>
  ${CATEGORIES.map((c) => {
    const items = PRODUCTS.filter((p) => p.cat === c.id).slice(0, 4);
    return `<section class="section">
      <h2>${c.emoji} ${esc(c.name)} <a class="see-all" href="#/category/${c.id}">See all</a></h2>
      <div class="grid">${items.map(productCard).join("")}</div>
    </section>`;
  }).join("")}`;
}

function viewCategory(catId) {
  const c = catById(catId);
  if (!c) return viewNotFound();
  const items = PRODUCTS.filter((p) => p.cat === catId);
  return `<section class="section">
    <h2>${c.emoji} ${esc(c.name)}</h2>
    <div class="grid">${items.map(productCard).join("")}</div>
  </section>`;
}

function viewSearch(query, catId) {
  const q = query.toLowerCase();
  let items = PRODUCTS.filter((p) => (p.name + " " + p.blurb).toLowerCase().includes(q));
  if (catId) items = items.filter((p) => p.cat === catId);
  return `<section class="section">
    <h2>Results for “${esc(query)}” <span class="muted">(${items.length})</span></h2>
    ${items.length ? `<div class="grid">${items.map(productCard).join("")}</div>`
      : `<div class="empty">🔍 Nothing found — but hey, that's money saved without even trying.</div>`}
  </section>`;
}

function viewProduct(id) {
  const p = productById(id);
  if (!p) return viewNotFound();
  const c = catById(p.cat);
  const pct = p.was ? Math.round(((p.was - p.price) / p.was) * 100) : 0;
  return `
  <div class="breadcrumb"><a href="#/">Home</a> › <a href="#/category/${p.cat}">${esc(c.name)}</a></div>
  <div class="product-page">
    <div class="product-img">${prodArt(p, "emoji-art xl")}</div>
    <div class="product-info">
      <h1>${esc(p.name)}</h1>
      <div class="card-rating">${stars(p.rating)} <span class="review-count">${p.reviews.toLocaleString()} ratings</span></div>
      <hr>
      <div class="price-block">
        ${pct ? `<span class="deal-flag">-${pct}%</span>` : ""}
        <span class="price big">${money(p.price)}</span>
        ${p.was ? `<div class="was-line">List price: <span class="was">${money(p.was)}</span></div>` : ""}
      </div>
      <p class="blurb">${esc(p.blurb)}</p>
      <h3>About this item</h3>
      <ul class="bullets">${p.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
    </div>
    <div class="buy-box">
      <div class="price big">${money(p.price)}</div>
      <div class="prime-badge">✓ zero<span>prime</span></div>
      <p class="delivery-line">FREE delivery to <strong>Your Imagination</strong> — as fast as you like.</p>
      <p class="stock">In Stock (infinitely — it's imaginary)</p>
      ${p.store ? `<p class="fine">Sold by <strong>${esc(p.store)}</strong> · Fulfilled by A to Zero</p>` : ""}
      <button class="btn btn-cart" onclick="addToCart('${p.id}')">Add to Cart</button>
      <button class="btn btn-buy" onclick="addToCart('${p.id}'); location.hash='#/checkout'">Buy Now</button>
      <p class="fine">🔒 Transaction secured by not existing</p>
    </div>
  </div>`;
}

function viewCart() {
  const items = cartItems();
  if (!items.length) {
    return `<section class="section"><div class="empty">
      🛒 Your cart is empty.<br><small>Which, honestly, is also a win.</small><br><br>
      <a class="btn btn-cart inline" href="#/">Keep browsing</a>
    </div></section>`;
  }
  return `<section class="section cart-page">
    <div class="cart-list">
      <h2>Shopping Cart</h2>
      ${items.map((i) => `
        <div class="cart-row">
          <a href="#/product/${i.product.id}" class="cart-emoji">${prodArt(i.product, "")}</a>
          <div class="cart-mid">
            <a class="card-title" href="#/product/${i.product.id}">${esc(i.product.name)}</a>
            <div class="stock small">In Stock — ships from the Cloud of Pure Possibility</div>
            <div class="qty-controls">
              <button onclick="setCartQty('${i.product.id}', ${i.qty - 1})">−</button>
              <span>${i.qty}</span>
              <button onclick="setCartQty('${i.product.id}', ${i.qty + 1})">+</button>
              <a class="link" onclick="setCartQty('${i.product.id}', 0)">Delete</a>
            </div>
          </div>
          <div class="cart-price">${money(i.product.price * i.qty)}</div>
        </div>`).join("")}
      <div class="cart-subtotal">Subtotal (${cartCount()} item${cartCount() === 1 ? "" : "s"}): <strong>${money(cartTotal())}</strong></div>
    </div>
    <div class="cart-side">
      <div class="cart-subtotal">Subtotal (${cartCount()} item${cartCount() === 1 ? "" : "s"}): <strong>${money(cartTotal())}</strong></div>
      <div class="you-pay">You will actually pay: <strong>$0.00</strong> 🎉</div>
      <a class="btn btn-buy" href="#/checkout">Proceed to checkout</a>
    </div>
  </section>`;
}

function viewCheckout() {
  const items = cartItems();
  if (!items.length) return `<section class="section"><div class="empty">Nothing to check out. <a href="#/">Go find something imaginary.</a></div></section>`;
  return `<section class="section checkout-page">
    <h2>Checkout <span class="muted">(the fun part, minus the guilt part)</span></h2>
    <div class="checkout-grid">
      <div class="checkout-main">
        <div class="panel">
          <h3>1 &nbsp; Delivery address</h3>
          <p><strong>You</strong><br>The Comfiest Chair in the House<br>Your Imagination, Earth 00000</p>
          <p class="fine">No real address needed — the package is a feeling.</p>
        </div>
        <div class="panel">
          <h3>2 &nbsp; Payment method</h3>
          <p>💳 <strong>Card of Infinite Restraint</strong> ending in 0000</p>
          <p class="fine">This card charges nothing, always declines regret, and never expires.</p>
        </div>
        <div class="panel">
          <h3>3 &nbsp; Choose your delivery speed</h3>
          ${SHIPPING_OPTIONS.map((s, idx) => `
            <label class="ship-option">
              <input type="radio" name="ship" value="${s.id}" ${idx === 1 ? "checked" : ""}>
              <span><strong>${esc(s.label)}</strong> — ${esc(s.eta)}</span>
            </label>`).join("")}
          <p class="fine">Pick a longer wait for the full anticipation experience, or almost-instant if today is hard.</p>
        </div>
        <div class="panel">
          <h3>4 &nbsp; Review items</h3>
          ${items.map((i) => `<div class="review-row"><span>${i.product.img ? "" : i.product.emoji + " "}${esc(i.product.name.split("—")[0].trim())} × ${i.qty}</span><span>${money(i.product.price * i.qty)}</span></div>`).join("")}
        </div>
      </div>
      <div class="checkout-side panel">
        <button class="btn btn-buy" onclick="placeOrder(document.querySelector('input[name=ship]:checked').value)">Place your pretend order</button>
        <hr>
        <div class="summary-row"><span>Items:</span><span>${money(cartTotal())}</span></div>
        <div class="summary-row"><span>Shipping:</span><span>$0.00</span></div>
        <div class="summary-row"><span>Tax:</span><span>$0.00</span></div>
        <div class="summary-row total"><span>Order total:</span><span>${money(cartTotal())}</span></div>
        <div class="summary-row charged"><span>Amount charged:</span><span>$0.00</span></div>
        <p class="fine">By placing this order you agree to feel good about not spending ${money(cartTotal())}.</p>
      </div>
    </div>
  </section>`;
}

function viewThankYou(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return viewNotFound();
  return `<section class="section thankyou">
    <div class="ty-box">
      <div class="ty-check">✅</div>
      <h1>Order placed. Wallet untouched.</h1>
      <p>Order <strong>${esc(order.number)}</strong> · ${order.shippingLabel} · <strong>${orderEtaText(order)}</strong></p>
      <p class="ty-saved">You just kept <strong>${money(order.total)}</strong> in your pocket. Lifetime savings: <strong>${money(state.saved)}</strong> 💰</p>
      <div class="ty-actions">
        <a class="btn btn-buy" href="#/track/${order.id}">Track your package</a>
        <a class="btn btn-cart" href="#/">Keep browsing</a>
      </div>
      <p class="fine">Real craving satisfied. Zero dollars spent. Zero boxes landfilled.</p>
    </div>
  </section>`;
}

function viewOrders() {
  if (!state.orders.length) {
    return `<section class="section"><div class="empty">📭 No orders yet. The trucks are waiting for you.<br><br><a class="btn btn-cart inline" href="#/">Start shopping</a></div></section>`;
  }
  return `<section class="section">
    <h2>Your Orders</h2>
    ${state.orders.map((o) => {
      const m = orderMilestone(o);
      const delivered = orderProgress(o) >= 1;
      return `<div class="order-card">
        <div class="order-head">
          <div><span class="muted">ORDER PLACED</span><br>${new Date(o.placedAt).toLocaleString()}</div>
          <div><span class="muted">TOTAL (NOT CHARGED)</span><br>${money(o.total)}</div>
          <div><span class="muted">ORDER #</span><br>${esc(o.number)}</div>
        </div>
        <div class="order-body">
          <div class="order-status ${delivered ? "delivered" : ""}">${m.icon} <strong>${m.label}</strong> — ${delivered ? "arrived safe and sound" : orderEtaText(o)}</div>
          <div class="order-items">${o.items.map((i) => {
            const p = lineInfo(i);
            return `<a href="#/product/${p.id}" class="order-item" title="${esc(p.name)}">${prodArt(p, "")}<span>× ${i.qty}</span></a>`;
          }).join("")}</div>
          <div class="order-actions">
            <a class="btn btn-cart small" href="#/track/${o.id}">${delivered ? "View delivery" : "Track package"}</a>
            ${delivered && !o.opened ? `<a class="btn btn-buy small" href="#/track/${o.id}">📦 Open your package!</a>` : ""}
          </div>
        </div>
      </div>`;
    }).join("")}
  </section>`;
}

function viewTrack(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return viewNotFound();
  const progress = orderProgress(order);
  const delivered = progress >= 1;
  const truckPos = Math.min(97, progress * 100);
  return `<section class="section track-page">
    <h2>Tracking order ${esc(order.number)}</h2>
    <div class="panel">
      <h3 class="eta-line">${delivered ? "🏡 Delivered!" : orderEtaText(order)}</h3>
      <div class="truck-road">
        <div class="road"></div>
        <div class="truck" style="left:${truckPos}%">${delivered ? "🏡" : "🚚"}</div>
        <div class="house">🏠</div>
        <div class="warehouse">🏭</div>
      </div>
      <div class="progress-outer"><div class="progress-inner" style="width:${progress * 100}%"></div></div>
      <ol class="timeline">
        ${MILESTONES.map((m) => {
          const reached = progress >= m.at;
          const isCurrent = orderMilestone(order).key === m.key;
          return `<li class="${reached ? "reached" : ""} ${isCurrent ? "current" : ""}">
            <span class="tl-icon">${m.icon}</span>
            <div><strong>${m.label}</strong>${reached ? `<div class="tl-detail">${m.detail}</div>` : ""}</div>
          </li>`;
        }).join("")}
      </ol>
      ${delivered && !order.opened ? `
        <div class="package-arrived">
          <p>Your package is at the door! 🚪</p>
          <button class="btn btn-buy" onclick="openPackage('${order.id}')">📦 Open the package</button>
        </div>` : ""}
      ${delivered && order.opened ? `
        <div class="package-arrived opened">
          <p>Opened and enjoyed. Everything's in <a href="#/stuff">My Stuff</a>. ✨</p>
        </div>` : ""}
      ${!delivered ? `<p class="fine">This page updates automatically. Anticipation is 90% of the fun — the other 10% is also anticipation.</p>` : ""}
    </div>
  </section>`;
}

function openPackage(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || order.opened) return;
  order.opened = true;
  for (const i of order.items) {
    state.stuff.unshift({
      id: i.id, qty: i.qty, openedAt: Date.now(), orderNumber: order.number,
      name: i.name, emoji: i.emoji, img: i.img || null,
    });
  }
  saveState();
  confetti();
  showToast("🎉 <strong>Unboxed!</strong> Your imaginary goodies are now in My Stuff.");
  render();
}

function viewStuff() {
  return `<section class="section">
    <h2>My Stuff <span class="muted">— everything you "own", nothing you paid for</span></h2>
    <div class="stuff-stats">
      <div class="stat"><div class="stat-num">${money(state.saved)}</div><div class="stat-label">real money kept</div></div>
      <div class="stat"><div class="stat-num">${state.orders.length}</div><div class="stat-label">orders enjoyed</div></div>
      <div class="stat"><div class="stat-num">${state.stuff.reduce((a, s) => a + s.qty, 0)}</div><div class="stat-label">items unboxed</div></div>
      <div class="stat"><div class="stat-num">0</div><div class="stat-label">boxes in landfill</div></div>
    </div>
    ${state.stuff.length ? `<div class="grid">${state.stuff.map((s) => {
      const p = lineInfo(s);
      return `<div class="card stuff-card">
        <div class="card-img">${prodArt(p)}</div>
        <div class="card-body">
          <a class="card-title" href="#/product/${p.id}">${esc(p.name.split("—")[0].trim())}</a>
          <div class="muted small">× ${s.qty} · unboxed ${new Date(s.openedAt).toLocaleDateString()}</div>
          <div class="muted small">from order ${esc(s.orderNumber)}</div>
        </div>
      </div>`;
    }).join("")}</div>` : `<div class="empty">Nothing unboxed yet — packages land here after you open them.</div>`}
    <div class="danger-zone">
      <h3>Fresh start</h3>
      <p class="fine">Everything lives only in this browser. One click erases it all.</p>
      <button class="btn btn-danger" onclick="resetAll()">Erase all my data</button>
    </div>
  </section>`;
}

function viewAdd(query) {
  const pre = {
    name: query.get("name") || "",
    price: (query.get("price") || "").replace(/[^0-9.,]/g, ""),
    img: query.get("img") || "",
    store: query.get("store") || "",
  };
  const appUrl = location.origin + location.pathname;
  // The clipper runs in YOUR browser on the page YOU are viewing — it just
  // copies the product's title/price/image into A to Zero, one at a time.
  const clipper = `javascript:(()=>{const q=s=>document.querySelector(s);const m=(s,a)=>{const e=q(s);return e?(a?e.getAttribute(a):e.textContent):''};const t=m('meta[property="og:title"]','content')||document.title;const i=m('meta[property="og:image"]','content')||(q('#landingImage')?q('#landingImage').src:'');let p=m('meta[property="product:price:amount"]','content')||m('[itemprop=price]','content')||m('.a-price .a-offscreen')||m('[data-testid=price-wrap]')||'';p=(p.match(/[0-9]+([.,][0-9]{1,2})?/)||[''])[0].replace(',','.');window.open('${appUrl}#/add?name='+encodeURIComponent(t.slice(0,180))+'&price='+encodeURIComponent(p)+'&img='+encodeURIComponent(i)+'&store='+encodeURIComponent(location.hostname.replace('www.','')));})();`;
  return `<section class="section">
    <h2>⭐ Add any product <span class="muted">— clip it from the real store, "buy" it here</span></h2>
    <div class="checkout-grid">
      <div class="checkout-main">
        <div class="panel">
          <h3>Product details</h3>
          <div class="form-grid">
            <label>Product name *<input id="af-name" type="text" maxlength="200" placeholder="e.g. Sony WH-1000XM5 Headphones" value="${esc(pre.name)}"></label>
            <label>Price (USD) *<input id="af-price" type="text" inputmode="decimal" placeholder="e.g. 348.00" value="${esc(pre.price)}"></label>
            <label>Image URL <span class="muted">(optional)</span><input id="af-img" type="text" placeholder="https://…" value="${esc(pre.img)}"></label>
            <label>Where you saw it <span class="muted">(optional)</span><input id="af-store" type="text" maxlength="60" placeholder="e.g. amazon.com" value="${esc(pre.store)}"></label>
          </div>
          <button class="btn btn-buy" onclick="addCustomFromForm()">Add to My Finds</button>
        </div>
      </div>
      <div class="checkout-side panel">
        <h3>🔖 The 1-click clipper</h3>
        <p class="fine" style="font-size:13px">Browse any real store — Amazon, Temu, Walmart, anywhere. When something tempts you, click this bookmark and the product jumps here, pre-filled, instead of into your real cart.</p>
        <p class="fine" style="font-size:13px"><strong>Setup (once):</strong> show your bookmarks bar (Ctrl+Shift+B), then drag the button below onto it. On the phone: copy the code and paste it as a bookmark's URL.</p>
        <a class="btn btn-cart" href="${esc(clipper)}" onclick="showToast('Drag me to your bookmarks bar instead of clicking! 🔖'); return false;">📎 Send to A to Zero</a>
        <button class="btn btn-cart" onclick="navigator.clipboard.writeText(document.getElementById('clipper-code').textContent).then(()=>showToast('📋 Clipper code copied.'))">Copy clipper code</button>
        <details><summary class="fine">Show code</summary><pre id="clipper-code" class="clipper-code">${esc(clipper)}</pre></details>
        <p class="fine">The clipper only reads the page you're already looking at, one product at a time — nothing automated, nothing bulk.</p>
      </div>
    </div>
  </section>`;
}

function addCustomFromForm() {
  const name = $("#af-name").value.trim();
  const price = parseFloat(($("#af-price").value || "").replace(/[^0-9.,]/g, "").replace(",", "."));
  let img = $("#af-img").value.trim();
  const store = $("#af-store").value.trim() || "somewhere out there";
  if (!name || !(price > 0)) { showToast("⚠️ It needs at least a name and a price."); return; }
  if (!/^https?:\/\//i.test(img)) img = null;
  const p = {
    id: "c" + Date.now(),
    cat: "my-finds",
    store,
    emoji: "🛍️",
    img,
    name,
    price: +price.toFixed(2),
    was: null,
    rating: 5,
    reviews: 1,
    prime: true,
    blurb: `You spotted this at ${store} and routed the craving here instead of your wallet. Excellent move.`,
    bullets: [`Found at: ${store}`, `Their price: ${money(+price.toFixed(2))} — your price: $0.00`],
  };
  state.custom.unshift(p);
  saveState();
  useCatalog(catalogBase.products, catalogBase.categories);
  location.hash = "#/product/" + p.id;
  showToast("⭐ Saved to My Finds — now go \"buy\" it for free.");
}

function resetAll() {
  if (!confirm("Erase all orders, stuff, and savings history from this browser?")) return;
  localStorage.removeItem(LS_KEY);
  state = loadState();
  updateHeader();
  location.hash = "#/";
  render();
  showToast("🧹 All clear. Fresh start.");
}

function viewNotFound() {
  return `<section class="section"><div class="empty">🕳️ 404 — this page is even more imaginary than the products.<br><br><a class="btn btn-cart inline" href="#/">Back home</a></div></section>`;
}

/* ---------- router ---------- */
function render() {
  const hash = location.hash || "#/";
  const [path, queryStr] = hash.slice(2).split("?");
  const parts = path.split("/");
  const query = new URLSearchParams(queryStr || "");
  let html;
  switch (parts[0]) {
    case "":          html = viewHome(); break;
    case "category":  html = viewCategory(parts[1]); break;
    case "search":    html = viewSearch(decodeURIComponent(parts[1] || ""), query.get("cat")); break;
    case "product":   html = viewProduct(parts[1]); break;
    case "cart":      html = viewCart(); break;
    case "checkout":  html = viewCheckout(); break;
    case "thankyou":  html = viewThankYou(parts[1]); break;
    case "orders":    html = viewOrders(); break;
    case "track":     html = viewTrack(parts[1]); break;
    case "stuff":     html = viewStuff(); break;
    case "add":       html = viewAdd(query); break;
    default:          html = viewNotFound();
  }
  $("#main").innerHTML = html;
}

window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

/* ---------- boot ---------- */
buildHeaderStatics();
updateHeader();
useCatalog(BUILTIN_PRODUCTS, BUILTIN_CATEGORIES); // includes My Finds immediately
loadLiveCatalog();
