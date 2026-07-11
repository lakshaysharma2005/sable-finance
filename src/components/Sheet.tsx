"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

// Bottom sheet overlay, styled after the prototype's sheets.
// Portaled to document.body so position:fixed isn't trapped by page
// animations (transform) or the scrollable .shell-scroll container.
export function Sheet({
  onClose,
  children,
  background = "#0D0D0F",
  zIndex = 20,
  style,
}: {
  onClose: () => void;
  children: ReactNode;
  background?: string;
  zIndex?: number;
  style?: CSSProperties;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const scroll = document.querySelector<HTMLElement>(".shell-scroll");
    if (scroll) scroll.style.overflow = "hidden";
    return () => {
      if (scroll) scroll.style.overflow = "";
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex, maxWidth: 402, margin: "0 auto" }}>
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", animation: "fadeUp .2s ease both" }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background,
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(255,255,255,0.09)",
          animation: "fadeUp .25s ease both",
          maxHeight: "88dvh",
          overflowY: "auto",
          paddingBottom: "env(safe-area-inset-bottom)",
          ...style,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
