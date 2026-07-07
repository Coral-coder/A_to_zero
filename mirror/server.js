/* ============================================================
   A to Zero — store mirror
   Reverse-proxies a real shopping site (default amazon.com) so it
   renders at YOUR own address, strips the headers that stop us from
   modifying it, and injects an interceptor that turns every
   "Add to Cart" / "Buy Now" into a $0.00 add to the A to Zero cart.

   Same origin serves both the mirrored store (at /) and the simulator
   (at /__a2z/), so they share localStorage and the intercepted items
   flow straight into the existing cart / checkout / delivery engine.

   No accounts, no payments, no credentials: sign-in and real checkout
   are neutralized on the page. Personal, self-hosted, therapeutic use.
   ============================================================ */

const http = require("http");
const https = require("https");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const TARGET = (process.env.TARGET || "https://www.amazon.com").replace(/\/+$/, "");
const PORT = parseInt(process.env.PORT || "8080", 10);
const APP_DIR = process.env.APP_DIR || path.join(__dirname, "..");
const MIRROR_DIR = __dirname;
const APP_PREFIX = "/__a2z";

const up = new URL(TARGET);
const upClient = up.protocol === "https:" ? https : http;

const MIME = {
  ".html": "text/html;charset=utf-8", ".js": "text/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
};

/* ---------- static file serving (the simulator + inject.js) ---------- */
function serveFile(res, file, fallbackType) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found"); return; }
    const type = MIME[path.extname(file).toLowerCase()] || fallbackType || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
    res.end(buf);
  });
}

function serveStatic(res, urlPath) {
  let rel = urlPath.slice(APP_PREFIX.length).split("?")[0].split("#")[0];
  if (rel === "" || rel === "/") rel = "/index.html";
  const target = path.normalize(path.join(APP_DIR, rel));
  if (!target.startsWith(path.normalize(APP_DIR))) { res.writeHead(403); res.end("Forbidden"); return; }
  serveFile(res, target);
}

/* ---------- HTML rewrite: de-absolutize, drop CSP, inject ---------- */
function rewriteHtml(html) {
  // Turn absolute links back to the mirror's own origin so navigation
  // stays inside the proxy instead of jumping to the real site. Cover
  // both the www host and the bare apex (e.g. amazon.com / www.amazon.com).
  const apex = up.host.replace(/^www\./, "");
  const hosts = [up.host, apex, "www." + apex];
  const variants = [];
  for (const host of hosts) variants.push("https://" + host, "http://" + host, "//" + host);
  for (const v of variants) html = html.split(v).join("");
  // Kill any inline <meta> CSP that would block our injected script.
  html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/ig, "");
  const tag = '<script src="/__a2z/inject.js" data-a2z-inject></script>';
  if (html.includes("</head>")) return html.replace("</head>", tag + "</head>");
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, (m) => m + tag);
  return tag + html;
}

function offlinePage(err) {
  return `<!doctype html><meta charset=utf-8><title>A to Zero — mirror</title>
  <body style="font-family:Arial;max-width:640px;margin:60px auto;padding:0 20px;color:#131921">
  <h1>🛒 The store mirror couldn't reach ${up.host}</h1>
  <p>The upstream store didn't respond (<code>${String(err && err.code || err)}</code>).
  Big retailers actively block proxied traffic, so this can happen intermittently.</p>
  <p>You can still use the full simulator with its built-in and live-API catalog:</p>
  <p><a href="/__a2z/" style="display:inline-block;background:#ffd814;color:#131921;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Open A to Zero →</a></p>
  </body>`;
}

/* ---------- reverse proxy ---------- */
function proxy(req, res) {
  const headers = Object.assign({}, req.headers);
  headers.host = up.host;
  headers["accept-encoding"] = "identity"; // ask upstream not to compress
  delete headers["if-none-match"];
  delete headers["if-modified-since"];
  if (headers.referer) headers.referer = TARGET + "/";
  if (headers.origin) headers.origin = up.origin;

  const opts = { method: req.method, headers };
  const preq = upClient.request(TARGET + req.url, opts, (pres) => {
    const h = Object.assign({}, pres.headers);
    // Strip everything that would stop us from framing / modifying the page.
    delete h["x-frame-options"];
    delete h["content-security-policy"];
    delete h["content-security-policy-report-only"];
    delete h["strict-transport-security"];
    delete h["cross-origin-opener-policy"];
    delete h["cross-origin-embedder-policy"];
    delete h["report-to"];
    // Keep cookies working on our origin (drop Domain/Secure/SameSite=None).
    if (h["set-cookie"]) {
      h["set-cookie"] = [].concat(h["set-cookie"]).map((c) =>
        c.replace(/;\s*Domain=[^;]+/ig, "").replace(/;\s*Secure/ig, "").replace(/;\s*SameSite=None/ig, ""));
    }
    if (h.location) h.location = h.location.replace(TARGET, "").replace(/^https?:\/\/[^/]+/, "");

    const ct = String(h["content-type"] || "");
    if (ct.includes("text/html")) {
      const enc = String(pres.headers["content-encoding"] || "").toLowerCase();
      let stream = pres;
      if (enc === "gzip") stream = pres.pipe(zlib.createGunzip());
      else if (enc === "br") stream = pres.pipe(zlib.createBrotliDecompress());
      else if (enc === "deflate") stream = pres.pipe(zlib.createInflate());
      const chunks = [];
      stream.on("data", (c) => chunks.push(c));
      stream.on("end", () => {
        let html;
        try { html = rewriteHtml(Buffer.concat(chunks).toString("utf8")); }
        catch (e) { html = Buffer.concat(chunks).toString("utf8"); }
        delete h["content-encoding"];
        delete h["transfer-encoding"];
        h["content-length"] = Buffer.byteLength(html);
        res.writeHead(pres.statusCode || 200, h);
        res.end(html);
      });
      stream.on("error", () => { try { res.writeHead(502); res.end("decode error"); } catch (e) {} });
    } else {
      res.writeHead(pres.statusCode || 200, h);
      pres.pipe(res);
    }
  });
  preq.on("error", (e) => {
    res.writeHead(502, { "content-type": "text/html;charset=utf-8" });
    res.end(offlinePage(e));
  });
  if (req.method !== "GET" && req.method !== "HEAD") req.pipe(preq);
  else preq.end();
}

/* ---------- router ---------- */
const server = http.createServer((req, res) => {
  const u = req.url || "/";
  if (u === "/__a2z/inject.js") return serveFile(res, path.join(MIRROR_DIR, "inject.js"), "text/javascript;charset=utf-8");
  if (u === APP_PREFIX || u.startsWith(APP_PREFIX + "/")) return serveStatic(res, u);
  return proxy(req, res);
});

server.listen(PORT, () => {
  console.log(`A to Zero mirror on http://localhost:${PORT}`);
  console.log(`  mirroring : ${TARGET}`);
  console.log(`  simulator : http://localhost:${PORT}/__a2z/`);
});
