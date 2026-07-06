"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ACCENT, BG, mono, serif, TEXT } from "@/lib/ui";
import { BankIcon, CardIcon, HomeIcon, PlusIcon, ProfileIcon, RefreshIcon, StatsIcon } from "./Icons";
import { usePlaidConnect } from "./PlaidLinkButton";

const ACTIVE = "#0D0D0F";
const INACTIVE = "rgba(244,243,239,0.45)";

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        width: 54,
        height: 36,
        borderRadius: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? ACCENT : "transparent",
      }}
    >
      {children}
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { start: startLink } = usePlaidConnect(() => {
    setSheetOpen(false);
    router.refresh();
    window.location.reload();
  });

  async function refresh() {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      window.location.reload();
    } finally {
      setSyncing(false);
      setSheetOpen(false);
    }
  }

  const iconColor = (active: boolean) => (active ? ACTIVE : INACTIVE);

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 402,
          margin: "0 auto",
          background: BG,
          padding: "0 0 max(8px, env(safe-area-inset-bottom))",
          zIndex: 10,
        }}
      >
        <div
          style={{
            margin: "0 14px",
            padding: "8px 12px",
            borderRadius: 26,
            background: "rgba(22,22,24,0.96)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
            backdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Tab href="/" active={pathname === "/"}>
            <HomeIcon color={iconColor(pathname === "/")} />
          </Tab>
          <Tab href="/stats" active={pathname === "/stats"}>
            <StatsIcon color={iconColor(pathname === "/stats")} />
          </Tab>
          <span
            onClick={() => setSheetOpen(true)}
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              background: ACCENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 16px rgba(127,224,138,0.3)",
              cursor: "pointer",
            }}
          >
            <PlusIcon />
          </span>
          <Tab href="/transactions" active={pathname === "/transactions"}>
            <CardIcon color={iconColor(pathname === "/transactions")} />
          </Tab>
          <Tab href="/accounts" active={pathname === "/accounts"}>
            <ProfileIcon color={iconColor(pathname === "/accounts")} />
          </Tab>
        </div>
      </div>

      {sheetOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, maxWidth: 402, margin: "0 auto" }}>
          <div
            onClick={() => setSheetOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", animation: "fadeUp .2s ease both" }}
          />
          <div
            style={{
              position: "absolute",
              left: 14,
              right: 14,
              bottom: 34,
              background: "#161618",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 24,
              padding: 8,
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              animation: "fadeUp .25s ease both",
            }}
          >
            <div style={{ textAlign: "center", padding: "12px 0 10px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 100, background: "rgba(255,255,255,0.15)", margin: "0 auto 14px" }} />
              <div style={mono(10, 400, { letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(244,243,239,0.32)" })}>
                Sable
              </div>
            </div>
            <SheetAction
              icon={<BankIcon />}
              iconBg="rgba(127,224,138,0.14)"
              title="Connect a bank account"
              subtitle="Link via Plaid"
              onClick={startLink}
            />
            <SheetAction
              icon={
                <span style={{ display: "inline-flex", animation: syncing ? "spin 1s linear infinite" : undefined }}>
                  <RefreshIcon color="#C49A6B" />
                </span>
              }
              iconBg="rgba(196,154,107,0.14)"
              title={syncing ? "Refreshing…" : "Refresh data"}
              subtitle="Pull latest transactions and balances"
              onClick={refresh}
            />
          </div>
        </div>
      )}
    </>
  );
}

function SheetAction({
  icon,
  iconBg,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 14,
        borderRadius: 16,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          flex: "none",
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1 }}>
        <div style={serif(16, 400, { color: TEXT })}>{title}</div>
        <div style={mono(11, 400, { color: "rgba(244,243,239,0.4)", marginTop: 2 })}>{subtitle}</div>
      </span>
    </button>
  );
}
