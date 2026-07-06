import { initialOf, tint } from "@/lib/format";
import { mono } from "@/lib/ui";

// Merchant avatar: Plaid logo when available, otherwise letter initial on a tinted square.
export function TxAvatar({
  name,
  color,
  logoUrl,
  size = 38,
}: {
  name: string;
  color: string;
  logoUrl?: string | null;
  size?: number;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: 12, flex: "none", objectFit: "cover", background: tint(color) }}
      />
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...mono(14, 600),
        background: tint(color),
        color,
      }}
    >
      {initialOf(name)}
    </span>
  );
}
