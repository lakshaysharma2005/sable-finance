import type { CSSProperties } from "react";
import { CREDIT_CARD_ASPECT, mono } from "@/lib/ui";

type Props = {
  name: string;
  mask: string | null;
  color: string;
  style?: CSSProperties;
  onClick?: () => void;
};

export function AccountMiniCard({ name, mask, color, style, onClick }: Props) {
  const cardStyle: CSSProperties = {
    borderRadius: 14,
    padding: "12px 14px",
    background: color + "18",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    width: 130,
    aspectRatio: CREDIT_CARD_ASPECT,
    boxSizing: "border-box",
    ...style,
  };

  const content = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={mono(9, 700, { color, letterSpacing: 1 })}>{name.toUpperCase().slice(0, 12)}</span>
        <span
          style={{
            width: 15,
            height: 15,
            borderRadius: "50%",
            background: color,
            opacity: 0.85,
            flex: "none",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span style={mono(13, 500, { color: "rgba(244,243,239,0.65)" })}>••{mask ?? "????"}</span>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={{ ...cardStyle, cursor: "pointer", border: "none" }}>
        {content}
      </button>
    );
  }

  return <div style={cardStyle}>{content}</div>;
}
