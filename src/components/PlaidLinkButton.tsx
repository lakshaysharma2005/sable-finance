"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export type PlaidConnectOptions = {
  /** Existing plaid_items.id — opens Link in update mode for that Item. */
  itemId?: number;
  /**
   * When set with itemId, enables update mode Account Select so the user can
   * share additional accounts on the existing Item (instead of creating a duplicate).
   */
  accountSelection?: boolean;
  /**
   * New Link product set. Default `transactions` (banks/cards).
   * Use `investments` for Stocks (Robinhood and other brokerages).
   */
  products?: "transactions" | "investments";
};

function normalizeOptions(options: PlaidConnectOptions | number = {}): PlaidConnectOptions {
  return typeof options === "number" ? { itemId: options } : options;
}

// Fetches a link_token on demand, opens Plaid Link, and on success either
// exchanges a new public_token or completes an Item update.
//
// Pass default options to the hook, and/or override them per `start()` call
// (used by Accounts "Add ›" to add cards onto an existing Chase Item).
export function usePlaidConnect(onLinked: () => void, defaultOptions: PlaidConnectOptions | number = {}) {
  const defaultsRef = useRef(normalizeOptions(defaultOptions));
  defaultsRef.current = normalizeOptions(defaultOptions);

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<PlaidConnectOptions>(defaultsRef.current);

  const onSuccess = useCallback(
    async (public_token: string) => {
      setBusy(true);
      const { itemId } = sessionRef.current;
      try {
        if (itemId) {
          // Update mode: access_token unchanged — refresh accounts + status server-side.
          await fetch("/api/plaid/complete-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId }),
          });
        } else {
          await fetch("/api/plaid/exchange-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_token }),
          });
        }
        onLinked();
      } finally {
        setBusy(false);
        setLinkToken(null);
      }
    },
    [onLinked],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setLinkToken(null),
  });

  // Open Link as soon as the token arrives and the SDK is ready
  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  const start = useCallback(async (overrides?: PlaidConnectOptions) => {
    const opts = { ...defaultsRef.current, ...overrides };
    sessionRef.current = opts;
    setBusy(true);
    try {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          opts.itemId
            ? { itemId: opts.itemId, ...(opts.accountSelection ? { accountSelection: true } : {}) }
            : { ...(opts.products ? { products: opts.products } : {}) },
        ),
      });
      const data = await res.json();
      if (data.link_token) setLinkToken(data.link_token);
    } finally {
      setBusy(false);
    }
  }, []);

  return { start, busy };
}
