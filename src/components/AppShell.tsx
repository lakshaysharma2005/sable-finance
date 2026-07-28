"use client";

import { BottomNav } from "@/components/BottomNav";
import { PlaidConnectProvider } from "@/components/PlaidConnectProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PlaidConnectProvider onLinked={() => window.location.reload()}>
      <div className="shell">
        <div className="shell-scroll">{children}</div>
        <BottomNav />
      </div>
    </PlaidConnectProvider>
  );
}
