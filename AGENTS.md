# Agent instructions — StepFund
1. **Always read `HANDOFF.md` first** and follow its PROTOCOL (start → during → end).
2. Spec lives in `docs/DESIGN.md`; read only the sections the current checkpoint lists.
3. Visual reference: `docs/mockup/index.html` (static mock — do not ship it).
4. Rules: TypeScript strict · all money renders through `<Amount>` · all conversions through `src/lib/currency.ts` · never commit personal financial data · HashRouter only · keep UI minimal per DESIGN §7.
5. Before ending any chat, update `HANDOFF.md` and commit.
