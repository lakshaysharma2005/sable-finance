"use client";

import { createContext, useContext } from "react";
import { usePlaidConnect, type PlaidConnectOptions } from "./PlaidLinkButton";

type PlaidConnectApi = {
  start: (overrides?: PlaidConnectOptions) => Promise<void>;
  busy: boolean;
};

const PlaidConnectContext = createContext<PlaidConnectApi | null>(null);

export function PlaidConnectProvider({
  children,
  onLinked,
}: {
  children: React.ReactNode;
  onLinked: () => void;
}) {
  const api = usePlaidConnect(onLinked);
  return <PlaidConnectContext.Provider value={api}>{children}</PlaidConnectContext.Provider>;
}

export function usePlaidConnectContext(): PlaidConnectApi {
  const ctx = useContext(PlaidConnectContext);
  if (!ctx) throw new Error("usePlaidConnectContext must be used within PlaidConnectProvider");
  return ctx;
}
