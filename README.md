# A to Zero 📦

**Shop everything. Spend zero.**

A to Zero is a therapeutic shopping simulator. It looks and feels like a familiar
online megastore — browsing, deals, cart, checkout, order tracking, the doorbell
moment — but **no money is ever charged, no products ever ship, and no personal
data is ever collected**.

It's built for people working on shopping habits: you get the full ritual and the
dopamine of the hunt, the purchase, and the wait for delivery, without spending a
cent or shipping a box you don't need.

## Real products

On load, the app pulls **hundreds of real products with real photos** from free,
no-key public APIs and merges them into one browsable marketplace:

- **DummyJSON** — ~200 real branded goods (phones, laptops, watches, furniture, fashion…)
- **Open Food Facts** — real brand-name groceries from the open community database
- **Open Beauty Facts** — real beauty and care products

Prices for the Open Facts sources are invented (those databases don't carry
prices — and nothing here is for sale anyway). Every source loads
independently and is cached in your browser; if you're offline, a built-in
fictional catalog keeps the app fully usable.

Retailer APIs that require approved keys (Amazon PA-API, Walmart Affiliate,
AliExpress Affiliate, eBay, Best Buy) are not included — there is no
legitimate keyless access to those catalogs. If you obtain keys, the
`CATALOG_SOURCES` list in `app.js` is where a new source plugs in.

## Shop the real stores — spend nothing: the clipper 🔖

The **➕ Add Any Product** page gives you a one-click bookmarklet. Browse the
*actual* Amazon / Walmart / Temu / anywhere in your own browser, and when
something tempts you, click the clipper bookmark: the product's real name,
price, and photo jump into A to Zero, pre-filled, ready to "buy" for $0.00.
Clipped items get their own **My Finds** category and work with the full
order-and-delivery experience.

The clipper only reads the single product page you're already viewing —
one item at a time, at your click. It's the digital equivalent of writing
the product down on a sticky note: no automation, no bulk collection, no
interference with the store.

## The full loop

1. **Browse** the merged catalog across two dozen categories, with search, deals, ratings, and product pages.
2. **Add to cart** and adjust quantities.
3. **Check out** with the *Card of Infinite Restraint* (charges $0.00, never expires) — no forms, no passwords, no accounts.
4. **Choose your delivery speed** — the wait is part of the experience:
   - Standard: ~4 hours
   - Express: ~30 minutes
   - Almost-Instant: ~2 minutes
5. **Track your package** in real time: order placed → packed → shipped → local hub → out for delivery → delivered, with a little truck driving across the screen.
6. **Open the package** when it arrives — confetti included — and it lands in **My Stuff**.
7. Watch your **"money kept" total** grow with every order you didn't really place.

Delivery timers keep running even when the tab is closed (progress is computed
from timestamps), so you can genuinely come back later to find your package
has arrived.

## Privacy

- No backend, no network requests, no analytics.
- No accounts, passwords, emails, addresses, or payment details.
- All state lives in your browser's `localStorage` and can be erased anytime with the **"Erase all my data"** button in My Stuff.

## Running it

It's a fully static site — no build step, no dependencies. Pick whichever fits:

### Option 1 — Docker on Windows (recommended)

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) and start it (whale icon in the system tray).
2. Get this code onto your machine, e.g. in PowerShell:
   ```powershell
   git clone https://github.com/Coral-coder/A_to_zero.git
   cd A_to_zero
   ```
   (Or download the repo as a ZIP from GitHub and unzip it.)
3. Build and start the container:
   ```powershell
   docker compose up -d --build
   ```
4. Open **http://localhost:8080** in your browser. Done.

Useful commands:

```powershell
docker compose down          # stop it
docker compose up -d         # start it again
docker compose up -d --build # rebuild after changing files
docker compose logs -f       # watch the logs
```

With `restart: unless-stopped` in `compose.yaml`, the container comes back
automatically whenever Docker Desktop starts.

### Option 2 — no Docker, just open it

Double-click `index.html`, or serve it for nicer URLs:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Using it on your phone 📱

**From your Windows PC's container (same Wi-Fi):**

1. Find your PC's local IP: run `ipconfig` in PowerShell and look for
   `IPv4 Address` (something like `192.168.1.42`).
2. On your phone (same Wi-Fi network), open `http://192.168.1.42:8080`.
3. If it doesn't load, Windows Firewall is likely blocking the port. Allow it
   once in an **administrator** PowerShell:
   ```powershell
   netsh advfirewall firewall add rule name="A to Zero" dir=in action=allow protocol=TCP localport=8080
   ```

**Install it like an app:** the site is a PWA. When served over HTTPS (e.g. via
GitHub Pages) you can use your phone browser's **"Add to Home Screen"** to get a
full-screen app with the A-to-Zero icon that even works offline. Over plain
`http://` on your LAN it still works fine in the browser — it just skips the
offline caching.

The layout is fully responsive: two-up product grid, swipeable category bar,
and finger-sized buttons on small screens. Orders are stored per browser, so
your phone keeps its own cart, orders, and savings total.

## Files

| File            | Purpose                                             |
| --------------- | --------------------------------------------------- |
| `index.html`    | App shell: header, search, nav, footer              |
| `catalog.js`    | The fictional product catalog                       |
| `app.js`        | Routing, cart, checkout, delivery simulation, state |
| `styles.css`    | The familiar-but-friendly storefront look           |
| `manifest.json` | PWA manifest ("Add to Home Screen" support)         |
| `sw.js`         | Service worker for offline use                      |
| `icon.svg`      | App icon                                            |
| `Dockerfile`    | nginx container serving the app                     |
| `compose.yaml`  | One-command `docker compose up` setup               |

## Disclaimer

A to Zero is a parody/therapeutic simulation and is not affiliated with,
endorsed by, or connected to Amazon or any real retailer. All products,
brands, prices, and reviews are fictional.
