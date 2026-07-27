import type { CSSProperties } from "react";
import { moneyParts, rawAmountParts } from "@/lib/format";
import { mono, TER, TEXT } from "@/lib/ui";

type AmountDisplayProps = {
  amount?: number;
  raw?: string;
  prefix?: string;
  size?: number;
  centsSize?: number;
  color?: string;
  centsColor?: string;
  letterSpacing?: number;
  decimals?: number;
  style?: CSSProperties;
  className?: string;
};

export function AmountDisplay({
  amount,
  raw,
  prefix = "",
  size = 15,
  centsSize,
  color = TEXT,
  centsColor,
  letterSpacing,
  decimals = 2,
  style,
  className,
}: AmountDisplayProps) {
  const resolvedCentsColor = centsColor ?? (centsSize != null ? TER : color);
  const centsFontSize = centsSize ?? size;

  let dollars: string;
  let cents: string;
  let showCents: boolean;

  if (raw !== undefined) {
    const parts = rawAmountParts(raw);
    dollars = parts.dollars;
    cents = parts.cents;
    showCents = parts.hasDecimal;
  } else if (amount !== undefined) {
    const parts = moneyParts(amount, decimals);
    dollars = parts.dollars;
    cents = parts.cents;
    showCents = true;
  } else {
    return (
      <span
        className={className}
        style={mono(size, 500, { color, letterSpacing, whiteSpace: "nowrap", ...style })}
      >
        {prefix}—
      </span>
    );
  }

  return (
    <span
      className={className}
      style={mono(size, 500, { color, letterSpacing, whiteSpace: "nowrap", ...style })}
    >
      {prefix}
      {dollars}
      {showCents && (
        <span style={mono(centsFontSize, 500, { color: resolvedCentsColor, letterSpacing })}>.{cents}</span>
      )}
    </span>
  );
}
