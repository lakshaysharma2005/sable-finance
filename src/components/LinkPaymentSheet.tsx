"use client";

import { useEffect, useState } from "react";
import { TxAvatar } from "@/components/TxAvatar";
import { Sheet } from "@/components/Sheet";
import { money } from "@/lib/format";
import { ACCENT, mono, serif, TER, TEXT } from "@/lib/ui";

type Candidate = {
  id: number;
  date: string;
  name: string;
  amount: number;
  logoUrl: string | null;
  accountName: string;
  accountMask: string | null;
  hint: "venmo" | "zelle" | null;
};

type Props = {
  splitId: number;
  remaining: number;
  personLabel: string;
  onClose: () => void;
  onLinked: () => void;
};

export function LinkPaymentSheet({ splitId, remaining, personLabel, onClose, onLinked }: Props) {
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/owed/candidates?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { candidates?: Candidate[] } | null) => {
        if (!cancelled) setCandidates(data?.candidates ?? []);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  async function link(txId: number) {
    if (linkingId) return;
    setLinkingId(txId);
    setError(null);
    try {
      const res = await fetch("/api/owed/repayments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ splitId, transactionId: txId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to link");
        return;
      }
      onLinked();
      onClose();
    } finally {
      setLinkingId(null);
    }
  }

  return (
    <Sheet onClose={onClose} background="#161618" zIndex={40} style={{ padding: "0 0 28px" }}>
      <div style={{ textAlign: "center", padding: "4px 20px 12px" }}>
        <div style={mono(10, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: "#6B8AB0" })}>
          Link payment
        </div>
        <div style={{ ...serif(20, 400, { color: TEXT }), marginTop: 10 }}>{personLabel}</div>
        <div style={{ ...mono(13, 500, { color: "rgba(244,243,239,0.5)" }), marginTop: 6 }}>
          {money(remaining)} remaining
        </div>
      </div>

      <div style={{ padding: "0 20px 12px" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Venmo, Zelle…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: "14px 16px",
            color: TEXT,
            ...serif(15),
            outline: "none",
          }}
        />
      </div>

      {error && (
        <div style={{ textAlign: "center", padding: "0 20px 10px", ...mono(12, 500, { color: "#D98A7F" }) }}>
          {error}
        </div>
      )}

      <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
        {loading && (
          <div style={{ padding: 24, textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
            Loading…
          </div>
        )}
        {!loading && candidates.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
            No unmatched inflows found
          </div>
        )}
        {candidates.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={linkingId !== null}
            onClick={() => link(c.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 20px",
              background: "none",
              border: "none",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              cursor: linkingId ? "wait" : "pointer",
              opacity: linkingId && linkingId !== c.id ? 0.45 : 1,
              textAlign: "left",
            }}
          >
            <TxAvatar name={c.name} color="#44BCD5" logoUrl={c.logoUrl} accountName={c.accountName} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={serif(15, 400, {
                  color: TEXT,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                })}
              >
                {c.name}
              </div>
              <div style={mono(11, 400, { color: TER, marginTop: 3 })}>
                {c.date}
                {c.hint ? ` · ${c.hint}` : ""}
                {` · ${c.accountName}`}
              </div>
            </div>
            <div style={mono(14, 500, { color: ACCENT, flex: "none" })}>+{money(c.amount)}</div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
