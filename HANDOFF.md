# HANDOFF — RubenYaro (single source of truth between chats)
> **Every new chat: read this file first, then only the DESIGN.md sections listed for the current checkpoint.** Keep this file ≤ 150 lines. Spec = `docs/DESIGN.md` (§ refs below). Visual ref = `docs/mockup/index.html`.

## 1. Snapshot
| Key | Value |
|---|---|
| Project | RubenYaro — USMLE cost + task planner, static SPA on GitHub Pages |
| Stack | Vite · React 18 · TS strict · Tailwind v4 · Zustand(persist) · HashRouter · recharts · dnd-kit · cmdk · date-fns · vitest |
| Current checkpoint | **All checkpoints complete (CP0–CP11 + Redesign + Versioned Deploy `v1.1.0`)** |
| Last updated | 2026-11-18 · by: v1.1.0 redesign & deploy session |
| Build status | green (`npm run build && npm test && npm run lint` — 5 test files, 27 tests pass) |
| Live URL | https://dawnsommer.github.io/RubenYaro/ |

## 2. Checkpoints  (`[ ]` todo · `[~]` in progress · `[x]` done)
Do them **in order**. One checkpoint ≈ one chat. Don't start the next until "Done when" passes.

| # | Status | Checkpoint | Read | Done when |
|---|---|---|---|---|
| CP0 | [x] | Scaffold + deploy pipeline | §2, §10 | `npm run dev/build/test` work; `deploy.yml` deploys to Pages; HashRouter with 6 empty routes |
| CP1 | [x] | Design tokens + UI kit + AppShell | §7, §3, mockup | tokens.css light/dark; all §7.4 components; Sidebar/BottomNav/RateBar shell (static values) responsive 360–1440 |
| CP2 | [x] | Types + store + persistence + seed | §4, §9, seed.json | `types/index.ts` = §4 (incl. `maybe`, `variants`); store CRUD for all entities; persist key `rubenyaro:v1` + migrate(); export/import JSON (+ seed-format merge import); seed loader; `.gitignore` keeps `private/` |
| CP3 | [x] | Currency engine + rates + Amount/MoneyInput | §5, §6.0, §7.4 | `currency.ts` all formulas + tests green; `rates.ts` primary→fallback→cache 12h→manual; RateBar live & editable; `Amount` + `MoneyInput` (parses `1.2k`, `3 lakh`, `450*3`) |
| CP4 | [x] | Accounts + ledger | §6.3, §5.4 | CRUD, deposit/withdraw/transfer (cross-currency), balances, reserved, ledger view, sparkline |
| CP5 | [x] | Costs (core) | §6.2, §4 selectors | CRUD, sub-costs (expand, Σ, include + Maybe toggles), variants switcher, temporary, recurring, included toggle, archive, drag reorder, views: phase/category/table |
| CP6 | [x] | Payments + statuses + Timeline view | §6.2 tabs 3–4, §4 | Record payment from cost/account; status auto (Paid/Partial/Due soon/Overdue); Breakdown tab; Timeline view; CSV export |
| CP7 | [x] | Dashboard | §6.1 | All 9 blocks with real selectors; onboarding empty state |
| CP8 | [x] | Tasks + key dates | §6.4, §6.6 Journey | List/Board/Upcoming, quick-add syntax, checklist, progress trackers, linked cost prompt, undo, countdowns, starter checklist |
| CP9 | [x] | Planner | §6.5 | Affordability, savings goal + cash-flow chart, rate what-if, converter, scenarios |
| CP10 | [x] | Settings + ⌘K + privacy + PWA | §6.6, §6.7, §8, §9 | All settings sections; palette; shortcuts; privacy blur; snapshots; backup nudge; offline PWA |
| CP11 | [x] | QA + polish + release | §11 | Tests green, Lighthouse ≥90/95, a11y pass, README usage, tagged v1.0.0 |

## 3. Active work  (only the current checkpoint — overwrite each session)
- **Goal:** Complete — `v1.1.0` deployed live to GitHub Pages (`https://dawnsommer.github.io/RubenYaro/`).
- **Next steps:** Any future UI/feature requests: bump `version` in `package.json`, run `npm run build && npm test && npm run lint`, push to `main`, and click **Update & Reload App** in `Settings` on the live site.
- **Blockers / questions for user:** none.

## 4. Decisions (append one line each; never delete)
- D1 Local-first, no backend; localStorage via Zustand persist. Repo holds no personal data.
- D2 HashRouter (GitHub Pages has no SPA fallback).
- D3 Money stored as entered `{amount,currency}`; conversion only in selectors/display.
- D4 Canonical comparison currency = PKR. Default conversion mode = `effective` (USD × 300).
- D5 Three modes: market (live/manual), effective (flat 300), detailed (market + tax % or fixed PKR).
- D6 Rate source: open.er-api.com → fallback fawazahmed0 currency-api (jsdelivr) → cached → manual.
- D7 Cost with sub-costs: parent total = Σ included sub-costs (parent `money` ignored).
- D8 `docs/seed.json` holds the user's real journey values (public fees/estimates); only `verify:true` items are placeholders.
- D9 Project name = **RubenYaro**. Persist key `rubenyaro:v1`.
- D10 Personal data (balance ₨4.8M, loans, job payment, iPhone) lives in gitignored `private/my-data.json`; merged via Import. Never commit it.
- D11 `maybe` flag on Cost & SubCost; dashboard shows gap confirmed vs with-maybes.
- D12 `variants` + `activeVariantId` for alternative pricing (Flights: round trip vs separate one-ways).
- D13 Sanity check at card rate 300 (for tests): confirmed plan ₨4,346,500 (+ Visa Interview ₨60,000 = ₨4,406,500) → surplus ₨393,500 vs ₨4.8M; maybes +₨456,000 → short ₨62,500.
- D14 Added `pinned?: boolean` on `Task` + schema v2 migration; Dashboard top shows pinned upcoming tasks; Tasks page has manual drag/arrow sorting & pin buttons; UI shows actual market rate primary with smaller `×300` after-tax rate alongside; added `Visa Interview` (₨60k = ₨50k plane ticket + ₨10k hotel/food).
- D15 Versioned deploy (`version.json` emitted at build time with version + git SHA + timestamp, network-first HTML in `sw.js`, and "Update & Reload App" button in Settings that unregisters stale SW/caches while preserving `rubenyaro:v1` localStorage).

## 5. Session log (keep last 3; compress older into §6 as one line)
- **S14 · 2026-11-18 · Versioned Deploy** — Added build-time `version.json` manifest, `src/lib/version.ts`, network-first HTML caching in `sw.js`, and one-click "Update & Reload App" button in Settings.
- **S13 · 2026-11-18 · Redesign** — Simplified UI & mobile UX, pinned tasks at top of Dashboard, manual task sorting + pin buttons, dual Market + `×300` after-tax rate display, top live-rate refresh button, and added `Visa Interview` (₨60k).
- **S12 · 2026-11-18 · CP11** — Code-split Vite production bundle, wrote `README.md` usage guide, verified all 27 unit tests & strict TS build, and tagged `v1.0.0`.

## 6. History (one line per old session)
- **S11 · 2026-11-18 · CP10** — Built `SettingsPage.tsx` (6 sections, JSON import/merge, snapshots, backup nudge, RESET), `CommandPalette.tsx` (`⌘K` + shortcuts), and offline PWA (`manifest.webmanifest` + `sw.js`).
- **S10 · 2026-11-18 · CP9** — Built `PlannerPage.tsx` with affordability check, savings goal + cash-flow chart, rate what-if sliders, quick converter, and scenario toggles.
- **S9 · 2026-11-18 · CP8** — Built `TasksPage.tsx` with List/Board/Upcoming views, quick-add syntax, checklist, progress trackers (+10/+40), linked cost payment toast, Undo toast, and key dates countdowns.
- **S8 · 2026-11-18 · CP7** — Built `DashboardPage.tsx` with all 9 blocks, real selectors, maybes toggle, category donut, phase bars, and 3-step onboarding state.
- **S7 · 2026-11-18 · CP5/CP6** — Implemented `CostsPage.tsx` + `CostDetailSheet.tsx` (sub-costs, variants switcher, maybe/included, temporary/recurring, drag reorder, 4 views, payments, Breakdown tab, CSV export).
- **S6 · 2026-11-18 · CP4** — Built `selectors.ts` (verified D13 sanity test), `AccountsPage.tsx` with CRUD, cross-currency transfers, sparklines, and ledger view.
- **S5 · 2026-11-18 · CP3** — Implemented `currency.ts`, `rates.ts` (primary→fallback→12h cache→manual), `parseAmount.ts`, `format.ts`, wired `Amount`/`MoneyInput`/`RateBar`.
- **S4 · 2026-11-18 · CP2** — Added §4 TypeScript data model, Zustand persist store (`rubenyaro:v1`) with migrations, seed loader, and JSON export/import + seed merge.
- **S3 · 2026-11-18 · CP1** — Built light/dark tokens.css, all §7.4 UI kit components, and responsive AppShell/Sidebar/BottomNav/RateBar.
- **S2 · 2026-11-18 · CP0** — Scaffolded Vite + React 18 + TS strict + Tailwind v4, deploy.yml, HashRouter 6 routes, vitest.
- **S1 · 2026-11-18 · Design** — Renamed to RubenYaro; real starter values in seed.json + private/my-data.json; added `maybe` + `variants`.
- **S0 · 2026-11-18 · Design** — Wrote DESIGN.md, seed.json, mockup, HANDOFF/AGENTS/GEMINI.

## 7. Known issues / tech debt
- —

## 8. File map (update when adding top-level modules)
`docs/DESIGN.md` spec · `docs/seed.json` starter data · `private/my-data.json` personal data (gitignored) · `docs/mockup/index.html` visual ref · `public/{sw.js,manifest.webmanifest,icon.svg}` · `src/types` · `src/lib` (currency, rates, format, parseAmount, dates, csv, version) · `src/store` (useStore, selectors, migrations, seed) · `src/components/{ui,layout}` · `src/features/{dashboard,costs,accounts,tasks,planner,settings}`

---
## PROTOCOL (mandatory for every chat)
**Start of chat**
1. Read `HANDOFF.md` fully. Read only the DESIGN.md § listed for the current CP.
2. `git log --oneline -5` and `git status` to confirm state matches §1/§3. If mismatch, trust the code, fix HANDOFF.
3. Mark the CP `[~]`, restate goal in one line, then work.

**During**
- Small commits: `cpN: <what>` (e.g. `cp3: add detailed-mode inverse`).
- Don't refactor outside the CP scope. Don't change §4 types without adding a migration + a Decision line.
- If context is getting long: stop at a green build, run the End protocol, tell the user "Checkpoint saved — continue in a new chat."

**End of chat (always, even if unfinished)**
1. `npm run build && npm test` — note result in §1 Build status.
2. Update §1 (current CP, date), §2 status, overwrite §3 with exact next steps (file + function level), append to §4/§7 if needed.
3. Add a §5 entry (≤ 2 lines). If §5 has > 3 entries, move the oldest to §6 as one line.
4. Commit: `handoff: CPn <status>`.

**Kickoff prompt for a new chat (user pastes this):**
> Continue the RubenYaro project. Follow the PROTOCOL in `HANDOFF.md` exactly: read HANDOFF.md, then only the DESIGN.md sections for the current checkpoint, verify git state, complete the checkpoint, and update HANDOFF.md before ending.
