// Shared display formatting (matches the design prototype's conventions).

export const MINUS = "\u2212"; // typographic minus, as in the prototype

export function money(n: number, decimals = 2): string {
  return (
    "$" +
    Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

export function moneyParts(n: number, decimals = 2) {
  const [whole, frac = ""] = Math.abs(n).toFixed(decimals).split(".");
  return {
    dollars: Number(whole).toLocaleString("en-US"),
    cents: frac.padEnd(decimals, "0"),
  };
}

export function rawAmountParts(raw: string) {
  const [whole, frac = ""] = raw.split(".");
  return {
    dollars: whole ? Number(whole).toLocaleString("en-US") : "0",
    cents: frac,
    hasDecimal: raw.includes("."),
  };
}

// Signed amount in UI convention (input: UI sign, negative = spend)
export function fmtSigned(n: number, decimals = 2): string {
  return (n < 0 ? MINUS : "+") + money(n, decimals);
}

// Plaid convention (positive = outflow) -> display string
export function fmtPlaidAmount(plaidAmount: number, decimals = 2): string {
  return fmtSigned(-plaidAmount, decimals);
}

export function tint(color: string): string {
  return color + "22";
}

export function initialOf(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}
