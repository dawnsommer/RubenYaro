# Agent instructions — RubenYaro

This repo is worked on by **more than one AI coding agent** (Google Antigravity / Gemini and Claude Code), often alternating between sessions.
This file is the single source of rules for all of them. `CLAUDE.md` and `GEMINI.md` only point here — edit rules **here**, never in those.

## 1. Start of every session
1. `git pull --rebase` (if a remote is set) → `git status` must be clean. If it isn't, another agent left work behind: read the diff, finish or commit it first.
2. Read **`HANDOFF.md`** fully and follow its PROTOCOL.
3. Read only the `docs/DESIGN.md` sections the current checkpoint lists. Note: **§6–§7 visual/UX details are superseded by HANDOFF §4 decisions D16+** (v2 redesign).

## 2. Rules (all agents)
- TypeScript strict · `npm run build && npm test` must stay green.
- All money renders through `<Amount>`; all conversions go through `src/lib/currency.ts`; totals come from `src/store/selectors.ts`.
- Never commit personal financial data (`private/` is gitignored).
- HashRouter only (GitHub Pages).
- UI: calm & minimal. **No side drawers.** Edit things inline (expand in place); use the centred `Sheet` modal only for small forms. Colours only via CSS variables in `src/styles/tokens.css`.
- Don't change `src/types` without a migration in `src/store/migrations.ts` + a Decision line in HANDOFF §4.

## 3. Multi-agent etiquette
- Never end a session with uncommitted changes — the next agent may be a different tool.
- Sign your HANDOFF session-log entry with the agent name, e.g. `S16 · 2026-11-18 · Claude Code — …` or `S17 · … · Antigravity — …`.
- Commit messages: `<area>: <what>` (e.g. `costs: inline editor`). Agent-specific co-author trailers are fine.
- Don't rewrite another agent's decisions; append a new Decision that supersedes it.
- Tool-specific folders (`.claude/`, `.gemini/`, `.agent/`) may hold config, but **no project rules** — rules live in this file.

## 4. End of every session
Update `HANDOFF.md` (§1 snapshot, §3 next steps, §5 log) and commit. If you shipped UI, bump `version` in `package.json`.
