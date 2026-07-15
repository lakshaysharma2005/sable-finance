export const AMOUNT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"] as const;

export function formatAmtDisplay(amt: string): string {
  const parts = amt.split(".");
  const whole = parts[0] ? Number(parts[0]).toLocaleString("en-US") : "0";
  return amt.includes(".") ? `${whole}.${parts[1] ?? ""}` : whole;
}

export function applyAmountKey(current: string, key: string): string {
  if (key === "⌫") return current.slice(0, -1);
  if (key === ".") {
    if (current.includes(".")) return current;
    return (current || "0") + ".";
  }
  if (current.includes(".") && (current.split(".")[1]?.length ?? 0) >= 2) return current;
  if (current.replace(".", "").length >= 7) return current;
  return current === "0" ? key : current + key;
}
