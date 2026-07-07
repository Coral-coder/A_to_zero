# A to Zero 📦

**Shop everything. Spend zero.**

A to Zero is a therapeutic shopping simulator. It looks and feels like a familiar
online megastore — browsing, deals, cart, checkout, order tracking, the doorbell
moment — but **no money is ever charged, no products ever ship, and no personal
data is ever collected**.

It's built for people working on shopping habits: you get the full ritual and the
dopamine of the hunt, the purchase, and the wait for delivery, without spending a
cent or shipping a box you don't need.

## The full loop

1. **Browse** a catalog of 30+ (entirely fictional) products across 8 categories, with search, deals, ratings, and product pages.
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

It's a fully static site — no build step, no dependencies.

```bash
# Option 1: just open it
open index.html

# Option 2: serve it (nicer URLs, no file:// quirks)
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

| File         | Purpose                                             |
| ------------ | --------------------------------------------------- |
| `index.html` | App shell: header, search, nav, footer              |
| `catalog.js` | The fictional product catalog                       |
| `app.js`     | Routing, cart, checkout, delivery simulation, state |
| `styles.css` | The familiar-but-friendly storefront look           |

## Disclaimer

A to Zero is a parody/therapeutic simulation and is not affiliated with,
endorsed by, or connected to Amazon or any real retailer. All products,
brands, prices, and reviews are fictional.
