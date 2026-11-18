/**
 * Parses natural money input strings (§7.4):
 * - Plain numbers: "1200", "1,200.50"
 * - Shorthands: "1.2k" -> 1200, "2.5m" -> 2500000, "3 lakh" / "3 lac" -> 300000, "1.5 cr" -> 15000000
 * - Simple arithmetic expressions: "450*3", "1000 + 250", "300000 / 2", "500 - 50"
 * Returns null if invalid.
 */
function parseTerm(term: string): number | null {
  const s = term.trim().toLowerCase().replace(/^[₨$]\s*/, '').replace(/,/g, '');
  if (!s) return null;

  const crMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:crore|cr)$/);
  if (crMatch) return parseFloat(crMatch[1]) * 10_000_000;

  const lakhMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?|l)$/);
  if (lakhMatch) return parseFloat(lakhMatch[1]) * 100_000;

  const mMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:m|mn|mil|million)$/);
  if (mMatch) return parseFloat(mMatch[1]) * 1_000_000;

  const kMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*k$/);
  if (kMatch) return parseFloat(kMatch[1]) * 1_000;

  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    const val = Number(s);
    return Number.isFinite(val) ? val : null;
  }

  return null;
}

export function parseAmount(input: string): number | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  // Check simple binary arithmetic: A op B (with * / + -)
  // First handle addition/subtraction outside of unary sign
  const addSubMatch = cleaned.match(/^(.+?)\s*([+-])\s*(.+)$/);
  if (addSubMatch) {
    const left = parseAmount(addSubMatch[1]);
    const right = parseAmount(addSubMatch[3]);
    if (left !== null && right !== null) {
      return addSubMatch[2] === '+' ? left + right : left - right;
    }
  }

  const mulDivMatch = cleaned.match(/^(.+?)\s*([*/×÷])\s*(.+)$/);
  if (mulDivMatch) {
    const left = parseAmount(mulDivMatch[1]);
    const right = parseAmount(mulDivMatch[3]);
    if (left !== null && right !== null) {
      const op = mulDivMatch[2];
      if (op === '*' || op === '×') return left * right;
      if ((op === '/' || op === '÷') && right !== 0) return left / right;
      return null;
    }
  }

  return parseTerm(cleaned);
}
