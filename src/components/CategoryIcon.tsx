import type { CSSProperties } from "react";

const SIZES = {
  sm: { font: 14, dot: 9, dotRadius: "50%" as const },
  md: { font: 16, dot: 9, dotRadius: "50%" as const },
  lg: { font: 24, dot: 16, dotRadius: 5 as const },
};

export function CategoryIcon({
  emoji,
  color,
  size = "sm",
  style,
}: {
  emoji: string | null;
  color: string;
  size?: keyof typeof SIZES;
  style?: CSSProperties;
}) {
  const s = SIZES[size];
  if (emoji) {
    return <span style={{ fontSize: s.font, lineHeight: 1, flex: "none", ...style }}>{emoji}</span>;
  }
  return (
    <span
      style={{
        width: s.dot,
        height: s.dot,
        borderRadius: s.dotRadius,
        background: color,
        flex: "none",
        ...style,
      }}
    />
  );
}
