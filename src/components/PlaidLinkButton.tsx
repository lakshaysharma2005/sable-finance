"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

// Fetches a link_token on demand, opens Plaid Link, and exchanges the
// public_token on success. Pass itemId to re-link an errored item.
export function usePlaidConnect(onLinked: () => void, itemId?: number) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSuccess = useCallback(
    async (public_token: string) => {
      setBusy(true);
      try {
        if (!itemId) {
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
    [onLinked, itemId],
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

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemId ? { itemId } : {}),
      });
      const data = await res.json();
      if (data.link_token) setLinkToken(data.link_token);
    } finally {
      setBusy(false);
    }
  }, [itemId]);

  return { start, busy };
}
