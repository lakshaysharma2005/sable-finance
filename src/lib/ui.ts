import type { CSSProperties } from "react";

// Design tokens from the prototype
export const BG = "#0D0D0F";
export const CARD = "#161618";
export const ACCENT = "#7FE08A";
export const TEXT = "#F4F3EF";
export const RED = "#D98A7F";
export const BORDER = "1px solid rgba(255,255,255,0.07)";
export const TER = "rgba(244,243,239,0.32)";

export const MONO = "var(--font-mono), monospace";
export const SERIF = "var(--font-serif), serif";

export function mono(size: number, weight = 400, extra: CSSProperties = {}): CSSProperties {
  return { fontFamily: MONO, fontSize: size, fontWeight: weight, ...extra };
}

export function serif(size: number, weight = 400, extra: CSSProperties = {}): CSSProperties {
  return { fontFamily: SERIF, fontSize: size, fontWeight: weight, ...extra };
}

export const microLabel: CSSProperties = mono(10, 400, {
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: TER,
});

export const card: CSSProperties = {
  background: CARD,
  border: BORDER,
  borderRadius: 24,
};

export const chipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  flex: "none",
  padding: "9px 14px",
  borderRadius: 999,
  ...mono(11, 400, { letterSpacing: 0.5 }),
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "all .2s",
};

export const chipOn: CSSProperties = {
  background: "rgba(127,224,138,0.14)",
  color: ACCENT,
  border: "1px solid rgba(127,224,138,0.4)",
};

export const chipOff: CSSProperties = {
  background: "transparent",
  color: "rgba(244,243,239,0.5)",
  border: "1px solid rgba(255,255,255,0.08)",
};
