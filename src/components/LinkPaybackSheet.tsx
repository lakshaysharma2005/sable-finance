"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { TxAvatar } from "@/components/TxAvatar";
import type { TxItem, TxSplit } from "@/lib/queries";
import type { PaybackCandidate, SplitDetail } from "@/lib/splits";
import { ACCENT, mono, serif, TEXT } from "@/lib/ui";

type Props = {
  tx: TxItem;
  split: TxSplit;
  onClose: () => void;
  onLinked: (tx: TxItem, split: SplitDetail) => void;
};

function formatAmount(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LinkPaybackSheet({ tx, split, onClose, onLinked }: Props) {
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<PaybackCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        const res = await fetch(`/api/splits/payback-candidates?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? "Failed to load payments");
          return;
        }
        if (!cancelled) setCandidates(data.candidates ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, q ? 200 : 0);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q]);

  async function link(candidate: PaybackCandidate) {
    if (linkingId != null) return;
    setLinkingId(candidate.id);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${tx.id}/splits/${split.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: candidate.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to link");
        return;
      }
      const updated = data.split as SplitDetail;
      onLinked(
        {
          ...tx,
          splits: tx.splits.map((s) =>
            s.id === updated.id
              ? {
                  id: updated.id,
                  amount: updated.amount,
                  name: updated.name,
                  settledAmount: updated.settledAmount,
                  outstanding: updated.outstanding,
                  paybacks: updated.paybacks,
                }
              : s,
          ),
        },
        updated,
      );
      onClose();
    } finally {
      setLinkingId(null);
    }
  }

  return (
    <Sheet onClose={onClose} background="#161618" zIndex={30}>
      <div style={{ textAlign: "center", padding: "4px 20px 8px" }}>
        <div style={mono(10, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: "#6B8AB0" })}>
          Link payment
        </div>
        <div style={{ ...serif(20, 400, { color: TEXT }), marginTop: 10 }}>
          {split.name ?? "Split"} · ${formatAmount(split.outstanding)} left
        </div>
      </div>

      <div style={{ padding: "8px 20px 12px" }}>
        <input
          type="search"
          placeholder="Search Venmo, Zelle…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "12px 14px",
            outline: "none",
            ...serif(15, 400, { color: TEXT }),
          }}
        />
      </div>

      <div style={{ padding: "0 20px 20px", maxHeight: "55vh", overflowY: "auto" }}>
        {loading && (
          <div style={{ ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }), padding: "16px 0" }}>Loading…</div>
        )}
        {!loading && candidates.length === 0 && (
          <div style={{ ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }), padding: "16px 0" }}>
            No unmatched inflows found
          </div>
        )}
        {candidates.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => link(c)}
            disabled={linkingId != null}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 0",
              border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "transparent",
              cursor: linkingId != null ? "wait" : "pointer",
              textAlign: "left",
              opacity: linkingId != null && linkingId !== c.id ? 0.45 : 1,
            }}
          >
            <TxAvatar name={c.name} logoUrl={c.logoUrl} color="#6B8AB0" accountName={c.accountName} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...serif(15, 400, { color: TEXT }), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.name}
              </div>
              <div style={mono(11, 400, { color: "rgba(244,243,239,0.38)" })}>
                {c.date} · {c.accountName}
              </div>
            </div>
            <div style={mono(13, 500, { color: ACCENT, flex: "none" })}>
              {linkingId === c.id ? "…" : `+$${formatAmount(Math.abs(c.amount))}`}
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div style={{ textAlign: "center", padding: "0 20px 16px", ...mono(12, 500, { color: "#D98A7F" }) }}>
          {error}
        </div>
      )}
    </Sheet>
  );
}
