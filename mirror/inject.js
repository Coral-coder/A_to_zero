/* ============================================================
   A to Zero — page interceptor (injected into mirrored store pages)
   Runs in YOUR browser on the page YOU are viewing. It:
     • lets the real store render normally (real catalog, real look)
     • intercepts Add to Cart / Buy Now so nothing real is purchased
     • drops that product into the A to Zero cart for a $0.00 "buy"
     • neutralizes real checkout & sign-in (no money, no credentials)
   Same origin as the simulator, so it writes straight to its state.
   ============================================================ */
(function () {
  "use strict";
  if (window.__a2zInjected) return;
  window.__a2zInjected = true;

  var STATE_KEY = "a2z-state-v1";

  /* ---------- helpers ---------- */
  function q(sel, root) { try { return (root || document).querySelector(sel); } catch (e) { return null; } }
  function txt(sel, root) { var e = q(sel, root); return e ? (e.textContent || "").trim() : ""; }
  function meta(prop) { var e = q('meta[property="' + prop + '"]') || q('meta[name="' + prop + '"]'); return e ? e.getAttribute("content") : ""; }
  function toNum(s) { var m = String(s || "").replace(/[,\s]/g, "").match(/[0-9]+(\.[0-9]{1,2})?/); return m ? parseFloat(m[0]) : NaN; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function money(n) { return "$" + n.toFixed(2); }

  /* ---------- extract a product from the page or a clicked tile ---------- */
  function extract(fromEl) {
    // If the click was inside a search-result tile, prefer that tile's data.
    var tile = fromEl && fromEl.closest && fromEl.closest('[data-asin]:not([data-asin=""]), .s-result-item, [data-component-type="s-search-result"], li.a-carousel-card');
    var name = "", price = NaN, img = "";
    if (tile) {
      name = txt("h2 a span, h2 span, .a-text-normal, [data-cy='title-recipe'] span", tile) || txt("h2", tile);
      price = toNum(txt(".a-price .a-offscreen", tile) || txt(".a-price", tile));
      var it = q("img.s-image, img", tile);
      img = it ? (it.getAttribute("src") || it.src) : "";
    }
    if (!name) name = meta("og:title") || txt("#productTitle") || document.title;
    if (!(price > 0)) {
      price = toNum(
        txt("#corePriceDisplay_desktop_feature_div .a-offscreen") ||
        txt("#corePrice_feature_div .a-offscreen") ||
        txt(".a-price .a-offscreen") ||
        meta("product:price:amount") ||
        txt('[data-a-color="price"] .a-offscreen') ||
        txt('[itemprop="price"]')
      );
    }
    if (!img) img = meta("og:image") || (q("#landingImage") ? q("#landingImage").src : "") || (q("#imgTagWrapperId img") ? q("#imgTagWrapperId img").src : "");
    name = (name || "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!(price > 0)) price = 0;
    return { name: name, price: price, img: img || null, store: location.hostname.replace(/^www\./, "") };
  }

  /* ---------- write into the A to Zero cart ---------- */
  function loadState() {
    var s; try { s = JSON.parse(localStorage.getItem(STATE_KEY)); } catch (e) { s = null; }
    s = s || {};
    s.cart = s.cart || {}; s.custom = s.custom || []; s.orders = s.orders || [];
    s.stuff = s.stuff || {}; s.stuff = Array.isArray(s.stuff) ? s.stuff : [];
    s.notified = s.notified || {}; if (typeof s.saved !== "number") s.saved = 0;
    return s;
  }

  function addToCart(p) {
    if (!p.name) { toast("⚠️ Couldn't read that product — try the product's own page."); return; }
    var id = "m" + hash(p.name + "|" + p.store);
    var st = loadState();
    if (!st.custom.some(function (c) { return c.id === id; })) {
      st.custom.unshift({
        id: id, cat: "my-finds", store: p.store, emoji: "🛍️", img: p.img,
        name: p.name, price: +Number(p.price).toFixed(2), was: null,
        rating: 5, reviews: 1, prime: true,
        blurb: "You spotted this on " + p.store + " and routed the craving into A to Zero instead of your wallet.",
        bullets: ["Seen on: " + p.store, "Their price: " + money(+Number(p.price).toFixed(2)) + " — your price: $0.00"],
      });
    }
    st.cart[id] = (st.cart[id] || 0) + 1;
    try { localStorage.setItem(STATE_KEY, JSON.stringify(st)); } catch (e) {}
    updateBar(st);
    syncStoreCart(st);
    toast('🛒 Added to A to Zero — <strong>' + escapeHtml(p.name.slice(0, 60)) + '</strong><br><span style="opacity:.85">' +
      (p.price > 0 ? money(p.price) + " kept in your pocket." : "$0.00 spent.") + '</span>');
  }

  function cartCount(st) { st = st || loadState(); var n = 0; for (var k in st.cart) n += st.cart[k]; return n; }

  // Make the store's OWN top-bar cart badge show the A to Zero pretend count,
  // so the familiar cart icon ticks up as you add. Amazon re-renders its nav
  // on its own, so re-apply periodically to keep our number.
  function syncStoreCart(st) {
    var n = cartCount(st);
    var els = document.querySelectorAll(
      "#nav-cart-count,.nav-cart-count,#nav-cart-count-container,#sw-gtc .a-size-large,[data-cart-count]");
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = n;
      var a = els[i].closest && els[i].closest("#nav-cart");
      if (a) a.setAttribute("aria-label", n + " items in cart");
    }
  }

  /* ---------- intercepting real store actions ---------- */
  function openCart() { location.href = "/__a2z/#/cart"; }
  function openCheckout() { location.href = "/__a2z/#/checkout"; }
  function openOrders() { location.href = "/__a2z/#/orders"; }

  // Match by URL *path* (works whether the href is absolute or relative).
  var CARTISH = /^\/(gp\/(cart|buy|sc)|cart|checkout|buy\b|gp\/aw\/c)/i;
  var SIGNIN = /\/(ap\/signin|gp\/sign-in|gp\/flex\/sign|gp\/navigation\/redirector.*signin)/i;
  var ORDERS = /\/(gp\/css\/order|gp\/your-account\/order|gp\/aw\/o|gp\/legacy\/order)/i;

  // "Proceed to checkout" style controls (cart page, sidesheet, buy box).
  var PTC_SEL = "#sc-buy-box-ptc-button,#hlb-ptc-btn-native,#attach-sidesheet-checkout-button," +
    '[name="proceedToRetailCheckout"],[data-feature-id="proceed-to-checkout-action"],' +
    '#turbo-checkout-pyo-button,#submitOrderButtonId';

  var BUY_ID_SEL = "#add-to-cart-button,#buy-now-button,#add-to-cart-button-ubb,#one-click-button," +
    '[name="submit.add-to-cart"],[name="submit.buy-now"],[name="submit.addToCart"],' +
    '[data-testid="add-to-cart"],[aria-labelledby*="add-to-cart"],[id*="add-to-cart"]';
  var BUY_TEXT = /\b(add to (cart|basket|bag)|buy now|buy it now|1-click)\b/i;

  function label(el) { return (el.value || el.textContent || (el.getAttribute && el.getAttribute("aria-label")) || "").trim(); }

  function isBuy(el) {
    var n = el.closest ? el.closest(BUY_ID_SEL) : null;
    if (n) return n;
    var btn = el.closest ? el.closest('button,input[type="submit"],input[type="button"],a,[role="button"]') : null;
    if (btn && BUY_TEXT.test(label(btn))) return btn;
    return null;
  }
  function isBuyNow(el) { return el.id === "buy-now-button" || /buy-now|buy\.now/i.test(el.name || "") || /\bbuy (now|it now)\b/i.test(label(el)); }

  function onClick(e) {
    var el = e.target;
    if (!el || !el.closest || el.closest("#a2z-bar")) return;

    // 1. Add to Cart / Buy Now buttons.
    var buy = isBuy(el);
    if (buy) {
      e.preventDefault(); e.stopImmediatePropagation();
      addToCart(extract(buy));
      if (isBuyNow(buy)) setTimeout(openCheckout, 350);
      return;
    }
    // 2. Proceed-to-checkout controls -> pretend checkout.
    if (el.closest(PTC_SEL)) {
      e.preventDefault(); e.stopImmediatePropagation();
      openCheckout();
      return;
    }
    // 3. Top-bar / any nav link, matched by resolved path.
    var a = el.closest("a[href]");
    if (a) {
      var p = a.pathname || "";
      if (SIGNIN.test(p) || a.id === "nav-link-accountList" || a.id === "nav-signin") {
        e.preventDefault(); e.stopImmediatePropagation();
        toast("🔒 No sign-in needed here — A to Zero never asks for accounts, passwords, or payment.");
        return;
      }
      if (ORDERS.test(p) || a.id === "nav-orders") {
        e.preventDefault(); e.stopImmediatePropagation();
        openOrders();
        return;
      }
      if (CARTISH.test(p) || a.id === "nav-cart" || (a.closest && a.closest("#nav-cart"))) {
        e.preventDefault(); e.stopImmediatePropagation();
        openCart();
        return;
      }
    }
  }

  function onSubmit(e) {
    var f = e.target;
    var action = "";
    try { action = new URL(f.action, location.href).pathname; } catch (x) { action = (f.getAttribute && f.getAttribute("action")) || ""; }
    if (CARTISH.test(action)) { e.preventDefault(); e.stopImmediatePropagation(); openCart(); return; }
    if (/add-to-cart|buy-now|handle-buy-box/i.test(action)) { e.preventDefault(); e.stopImmediatePropagation(); addToCart(extract(f)); }
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("submit", onSubmit, true);

  // Safety net: if we ever actually land on a real cart / checkout / sign-in /
  // orders page (a click that slipped through, or a JS redirect), bounce to
  // the pretend equivalent immediately — no flash of the real page.
  function guardPath() {
    var p = location.pathname || "";
    if (SIGNIN.test(p)) { location.replace("/__a2z/#/"); return true; }
    if (ORDERS.test(p)) { location.replace("/__a2z/#/orders"); return true; }
    if (CARTISH.test(p)) { location.replace("/__a2z/#/cart"); return true; }
    return false;
  }

  /* ---------- floating A to Zero bar ---------- */

  var bar, countEl;
  function buildBar() {
    bar = document.createElement("div");
    bar.id = "a2z-bar";
    bar.innerHTML =
      '<span class="a2z-dot">🧘</span>' +
      '<span class="a2z-msg"><strong>A to Zero simulation</strong> — nothing here costs money. Add to Cart lands in your pretend cart.</span>' +
      '<button class="a2z-btn" id="a2z-view">🛒 Pretend cart (<span id="a2z-count">0</span>)</button>';
    var css = document.createElement("style");
    css.textContent =
      "#a2z-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;align-items:center;gap:10px;" +
      "background:#131921;color:#fff;font:14px/1.3 Arial,Helvetica,sans-serif;padding:9px 14px;box-shadow:0 -3px 14px rgba(0,0,0,.35)}" +
      "#a2z-bar .a2z-dot{font-size:18px}" +
      "#a2z-bar .a2z-msg{flex:1;min-width:0}" +
      "#a2z-bar .a2z-msg strong{color:#ff9900}" +
      "#a2z-bar .a2z-btn{background:#ffd814;color:#131921;border:0;border-radius:999px;padding:8px 14px;font-weight:bold;cursor:pointer;white-space:nowrap}" +
      "#a2z-bar .a2z-btn:hover{background:#f7ca00}" +
      "@media(max-width:640px){#a2z-bar .a2z-msg{font-size:12px}}" +
      "#a2z-toast{position:fixed;left:50%;bottom:64px;transform:translateX(-50%) translateY(120px);z-index:2147483647;" +
      "background:#232f3e;color:#fff;padding:12px 18px;border-radius:10px;font:14px/1.4 Arial,sans-serif;max-width:88vw;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.4);transition:transform .3s ease;text-align:center}" +
      "#a2z-toast.show{transform:translateX(-50%) translateY(0)}" +
      "#a2z-toast strong{color:#ff9900}";
    (document.head || document.documentElement).appendChild(css);
    document.body.appendChild(bar);
    countEl = q("#a2z-count");
    q("#a2z-view").addEventListener("click", openCart);
    updateBar();
  }

  function updateBar(st) { if (countEl) countEl.textContent = cartCount(st); }

  var toastEl, toastTimer;
  function toast(html) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.id = "a2z-toast"; document.body.appendChild(toastEl); }
    toastEl.innerHTML = html;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3400);
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // Bounce off any real cart/checkout/sign-in page before drawing anything.
  if (guardPath()) return;

  function boot() { buildBar(); syncStoreCart(); }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
  // The store rebuilds its nav asynchronously — keep our count applied.
  setInterval(function () { try { syncStoreCart(); } catch (e) {} }, 1500);
})();
