# RubenYaro

A minimal, local-first web app to plan and track the full cost of the USMLE journey (USD ⇄ PKR), money across multiple accounts, and a USMLE to-do list. Hosted on GitHub Pages.

- Design spec: [docs/DESIGN.md](docs/DESIGN.md)
- Visual mockup: open [docs/mockup/index.html](docs/mockup/index.html) in a browser
- Build progress & handoff between AI chats: [HANDOFF.md](HANDOFF.md)

## Quick Start

```bash
npm install
npm run dev      # Start local dev server
npm test         # Run Vitest unit tests (currency engine, parseAmount, selectors, store)
npm run build    # Type-check (strict) + build static bundle into dist/
```

## Features

- **Dual-Currency Engine (USD ⇄ PKR):** Enter any cost or balance in USD or PKR. Switch between Market rate (live auto-sync with 12h cache + fallback), Card/Effective rate (default ₨300/USD), or Detailed mode (Market + % or fixed PKR tax).
- **Dashboard (`#/`):** Instant funding status (surplus or shortfall), confirmed vs. *with-maybes* toggle, spending power in USD, upcoming payments, cost by phase & category donut, accounts strip, pending tasks, and countdowns.
- **Costs (`#/costs`):** Grouped by phase or category, vertical Timeline view, and inline-editable Table view. Supports nested sub-costs (`Σ` of included items), pricing variants (`Round trip` vs `Separate one-ways`), `Maybe` uncertain costs, temporary windows, recurring subscriptions, payment recording, and CSV export.
- **Accounts (`#/accounts`):** Multi-currency accounts (PKR & USD), earmarked reserved amounts, balance sparklines, deposits, withdrawals, cross-currency transfers, and running-balance ledger.
- **Tasks (`#/tasks`):** List by phase, Kanban Board, and Upcoming views. Supports quick-add syntax (`Book Step 3 #step3 !must @2026-12-10`), checklists, numeric progress trackers (`+10` / `+40` buttons), and linked-cost payment prompts.
- **Planner (`#/planner`):** Affordability check, savings goal + cash-flow projection chart, exchange-rate what-if sliders, quick converter, and Lean / Expected / Comfortable scenario toggles.
- **Command Palette & Shortcuts:** Press `⌘K` (or `/`) for quick actions and search, `c` to toggle display currency, and `p` to toggle privacy blur.

## Privacy & Personal Data

Your financial data stays in your browser (`localStorage` key `rubenyaro:v1`). Nothing personal is committed to the repository.
- Public starter journey values live in `docs/seed.json`.
- Personal balances/obligations in `private/my-data.json` (gitignored) can be merged anytime via **Settings → Data & backup → Import JSON (Merge)**.
