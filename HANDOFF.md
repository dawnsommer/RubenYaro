# HANDOFF — RubenYaro (single source of truth between chats)
> **Every new chat (any agent — Claude Code or Antigravity/Gemini): read `AGENTS.md`, then this file, then only the DESIGN.md sections listed for the current checkpoint.** Keep this file ≤ 150 lines. Spec = `docs/DESIGN.md` (§ refs below; UI/UX in §6–§7 superseded by D16+). The static mockup was removed (no visual ref file).

## 1. Snapshot
| Key | Value |
|---|---|
| Project | RubenYaro — USMLE cost + task planner, static SPA on GitHub Pages |
| Stack | Vite · React 18 · TS strict · Tailwind v4 · Zustand(persist) · HashRouter · recharts · dnd-kit · cmdk · date-fns · vitest |
| Current checkpoint | **R5 v2.3.1 — Home boxes lead with after tax** |
| Last updated | 2026-11-18 · by: Claude Code (S19 · R5) |
| Build status | green (`npm run build && npm test` — 6 test files, 33 tests pass) · v2.3.0 live; v2.3.1 committed |
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
| R2 | [x] | v2 redesign (theme, shell, inline cost editor) | D16–D19 | Build/tests green; no side drawers; Costs edit inline; multi-agent files in place |
| R3 | [x] | Google sync · Inheritance page · Home hero · app icon | D20–D25 | Build/tests green; sync works on the live site; inheritance maths tested |
| R5 | [x] | Planner = month-by-month timeline (chart + month list) · scenarios · afford/dollar what-ifs · after-tax on cost rows & groups | D29–D30 | Build/tests green; checked narrow + wide |
| R4 | [x] | Simpler cost editor · Home: Total cost + Spare boxes · sub-cost due dates (schema v4) | D26–D28 | Build/tests green; checked on mobile + desktop |

## 3. Active work  (only the current checkpoint — overwrite each session)
- **Goal:** R5 shipped as `v2.3.0` (deployed).
- **Next steps (pick up here):**
  1. Personal data is already in the user's live app (imported S16); user still to sign in (Settings → Sync) and export a backup.
  2. Worker allow-list now includes `rubenyaro` (added by the user in Cloudflare, verified: `/oauth/start?app_id=rubenyaro…` → 302 to Google). Sign-in is direct only (D25).
  3. User plans to: export JSON + sync to Google, then **reset the app** so someone else can use it. Reset signs out of sync first (so the Google copy is never overwritten with an empty app).
  4. Installments in the user's plan add up to 12.6M vs the 11.6M estate — the page flags it; user to confirm the numbers.
  5. Optional polish (from R2): Money/Planner inline edit; task edit still uses the `Sheet` modal; a few old input classes in SettingsPage.
- **Blockers / questions for user:** installment total mismatch (step 4).

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
- D16 Multi-agent: `AGENTS.md` holds all rules; `CLAUDE.md` (Claude Code) and `GEMINI.md` (Antigravity) only import it. Sessions are signed with the agent name in §5. `.claude/launch.json` = dev-server preview config.
- D17 v2 theme: Geist font, violet accent `#6750F2` (dark `#9B8CFF`), soft-tinted status chips, subtle shadows, 18px card radius, gradient hero. Tokens in `src/styles/tokens.css`; shared `.field` / `.card` classes in `globals.css`.
- D18 v2 shell: no sidebar/RateBar. One sticky `TopBar` (nav pills, rate pill → rate modal, PKR/USD toggle, privacy, ⌘K, settings gear) + 5-tab mobile `BottomNav` (Home, Costs, Tasks, Money, Planner). Nav list lives in `components/layout/nav.ts`.
- D19 No side drawers: `Sheet` is now a centred modal (bottom sheet on mobile). Costs are edited **inline** — clicking a row expands `CostEditor` in place (name/amount, options, phase/category/due/priority, toggles, items, payments, "More options"). `CostDetailSheet` deleted. Deep link `#/costs?open=<id>` opens a cost (used by Home, Tasks, ⌘K). Costs views reduced to group by Phase/Category/Month + filter All/Unpaid/Paid/Maybe; Table view removed.
- D20 Schema v3: `AppData.inheritance?: InheritancePlan | null` (stand-alone; never feeds accounts/costs/totals). Migration passes it through (absent → null). Import/merge carries it; merge import now **unions** categories/phases by id instead of replacing them.
- D21 Inheritance page (`/inheritance`, `features/inheritance/`): estate − deductions (fixed or % — e.g. tax; can be "paid out" or go to an heir as a reimbursement) → shares by units → loans between heirs (auto-split: reimbursement holders lend first, rest equal) → installments × recipients allocation grid (+ "By installment" checklist, Auto-fill = fees/tax first then pro-rata by remaining need). Display unit lac/M/₨ via `<Amount pkrUnit>`. Maths in `calc.ts`, tested with synthetic numbers. User's real plan lives only in `private/my-data.json`.
- D22 Google sync (`src/lib/cloud.ts` + `store/cloudBridge.ts`): same shared Cloudflare Worker as Thunder tracker; reuses a ThunderShadow / Thunder tracker session from the shared origin (read-only), else own `app_id=rubenyaro` sign-in. Drive appDataFolder file `rubenyaro-state.json`; whole-document newest-wins, the losing copy kept locally (Settings → Sync → Restore). Auto market-rate refreshes don't count as edits. Keys: `rubenyaro:cloud-*`.
- D23 Home hero rebuilt (`dashboard/PlanHero.tsx`): verdict, then After-tax and Market lenses side by side (each: spare/short + Total plan), paid/to-pay/spare bar, small detail grid. Costs summary + Money page also show Total plan after tax **and** at market.
- D24 App icon = violet squircle, white R, gold coin (`public/icon.svg`, PNGs 180/192/512, `BrandMark.tsx`). Rate pill has a convert icon and the rate modal has a Quick convert. Shared-origin safety: SW only deletes `rubenyaro-` caches; Update & Reload only unregisters our own SW scope.
- D25 Supersedes the borrowing part of D22: RubenYaro signs in directly with its own `app_id=rubenyaro` (now on the Worker allow-list). It no longer reads Thunder tracker / ThunderShadow sessions.
- D26 Cost editor (supersedes the editor layout of D16+): one status control (In plan / Maybe / Left out) maps to `included`+`maybe`; category/phase/priority/due are pills that open native pickers; items use a status chip that cycles Counts → Maybe → Off; the payment form only opens on "Record payment"; "Estimate" lives in More options.
- D27 Home hero shows two boxes: **Total cost** (market, after-tax under it) and **Spare after everything** (market, with the after-tax spare in the same box). The verdict line still uses after tax.
- D28 Schema v4: `SubCost.dueDate?`. A cost's due = earliest of its own date and its counted items' dates (`costNextDue`); `costDueParts` splits a cost by date for the planner. Migration keeps only valid yyyy-mm-dd strings.
- D29 Planner (supersedes the §6.5 Planner layout): one timeline of what's still unpaid by month (after tax, overdue → this month, undated → target date), with scenarios and two what-ifs below. Quick converter lives only in the top-bar rate modal. No data changes.
- D30 Cost rows and group headers always show the after-tax total under the market total. `.prettierrc` = singleQuote, printWidth 110, trailingComma es5.
- D31 Supersedes D27's number order: Home's Total cost and Spare boxes show **after tax** as the big number (tagged "After tax") and **before tax** (market) underneath. User wants after tax always in mind.

## 5. Session log (keep last 3; compress older into §6 as one line; sign with agent name)
- **S19 · 2026-11-19 · Claude Code — R5 tweak** — Home hero boxes: after tax big, before tax below (D31). v2.3.1.
- **S18 · 2026-11-18 · Claude Code — R5** — Planner rebuilt: `features/planner/timeline.ts` (pure, tested) → month buckets of unpaid after-tax amounts, money-left line, lowest point, monthly saving needed, undated bucket placed at the target date (editable inline). Scenarios as 3 tiles, "Can I afford it?" and "If the dollar moves" (one % slider). Old Quick converter removed (lives in the top-bar rate modal). Cost rows + group headers always show after tax. Added `.prettierrc` (single quotes) — earlier ad-hoc prettier runs had switched files to double quotes. v2.3.0.
- **S16 · 2026-11-18 · Claude Code — R3** — (v2.1.1: direct sign-in only) Google sync (shared Worker / borrowed Thunder sign-in), Inheritance planner page, Home hero rebuilt (after-tax + market side by side), Lifestyle category, app icon + PNGs, rate-pill convert icon + quick convert, shared-origin cache fix, v2.1.0.

## 6. History (one line per old session)
- S17 · R4: simpler cost editor, Home Total/Spare boxes, sub-cost due dates (schema v4), v2.2.0.
- S15 · R2 redesign: multi-agent setup, new theme + shell, inline CostEditor, Sheet → centred modal, v2.0.0.
- S14 · Versioned deploy: `version.json`, network-first HTML in `sw.js`, Update & Reload button.
- **S13 · 2026-11-18 · Redesign** — Simplified UI & mobile UX, pinned tasks at top of Dashboard, manual task sorting + pin buttons, dual Market + `×300` after-tax rate display, top live-rate refresh button, and added `Visa Interview` (₨60k).
- **S12 · 2026-11-18 · CP11** — Code-split bundle, README usage guide, 27 tests + strict TS, tagged `v1.0.0`.
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
`AGENTS.md` rules (CLAUDE.md/GEMINI.md import it) · `docs/DESIGN.md` spec · `docs/seed.json` starter data · `private/my-data.json` personal data (gitignored) · `public/{sw.js,manifest.webmanifest,icon.svg}` · `src/types` · `src/lib` (currency, rates, format, parseAmount, dates, csv, version) · `src/store` (useStore, selectors, migrations, seed) · `src/components/{ui,layout}` (layout: TopBar, BottomNav, PageHeader, CommandPalette, nav.ts) · `src/features/{dashboard,costs,accounts,tasks,planner,settings}`

---
## PROTOCOL (mandatory for every chat)
**Start of chat**
1. Read `AGENTS.md` and `HANDOFF.md` fully. Read only the DESIGN.md § listed for the current CP.
2. `git pull --rebase` (if remote), `git log --oneline -5`, `git status` to confirm state matches §1/§3. If mismatch, trust the code, fix HANDOFF.
3. Mark the CP `[~]`, restate goal in one line, then work.

**During**
- Small commits: `cpN: <what>` (e.g. `cp3: add detailed-mode inverse`).
- Don't refactor outside the CP scope. Don't change §4 types without adding a migration + a Decision line.
- If context is getting long: stop at a green build, run the End protocol, tell the user "Checkpoint saved — continue in a new chat."

**End of chat (always, even if unfinished)**
1. `npm run build && npm test` — note result in §1 Build status.
2. Update §1 (current CP, date), §2 status, overwrite §3 with exact next steps (file + function level), append to §4/§7 if needed.
3. Add a §5 entry (≤ 2 lines, signed with your agent name). If §5 has > 3 entries, move the oldest to §6 as one line.
4. Commit: `handoff: CPn <status>`.

**Kickoff prompt for a new chat (user pastes this):**
> Continue the RubenYaro project. Read `AGENTS.md`, then follow the PROTOCOL in `HANDOFF.md` exactly: read HANDOFF.md, then only the DESIGN.md sections for the current checkpoint, verify git state, complete the checkpoint, and update HANDOFF.md before ending.
