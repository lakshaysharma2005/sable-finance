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
