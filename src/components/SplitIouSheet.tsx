"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { TxAvatar } from "@/components/TxAvatar";
import type { TxItem, TxSplit } from "@/lib/queries";
import type { SplitDetail, SplitPaybackItem } from "@/lib/splits";
import { ACCENT, mono, serif, TEXT } from "@/lib/ui";

type Props = {
  tx: TxItem;
  split: TxSplit;
  onClose: () => void;
  onUpdated: (tx: TxItem) => void;
  onLinkPayment: () => void;
};

function formatAmount(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SplitIouSheet({ tx, split, onClose, onUpdated, onLinkPayment }: Props) {
  const [detail, setDetail] = useState<SplitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${tx.id}/splits/${split.id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load split");
        return;
      }
      setDetail(data as SplitDetail);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.id, split.id]);

  async function unlink(payback: SplitPaybackItem) {
    if (unlinkingId != null) return;
    setUnlinkingId(payback.id);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${tx.id}/splits/${split.id}/paybacks/${payback.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to unlink");
        return;
      }
      const updated = data.split as SplitDetail;
      setDetail(updated);
      onUpdated({
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
      });
    } finally {
      setUnlinkingId(null);
    }
  }

  const owed = detail?.amount ?? split.amount;
  const settled = detail?.settledAmount ?? split.settledAmount;
  const outstanding = detail?.outstanding ?? split.outstanding;
  const name = detail?.name ?? split.name ?? "Split";
  const paybacks = detail?.paybacks ?? split.paybacks ?? [];

  return (
    <Sheet onClose={onClose} background="#161618" zIndex={25}>
      <div style={{ textAlign: "center", padding: "4px 20px 8px" }}>
        <div style={mono(10, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: "#C73DF4" })}>
          Split IOU
        </div>
        <div style={{ ...serif(22, 400, { color: TEXT }), marginTop: 10 }}>{name}</div>
        <div style={{ ...mono(12, 500, { color: "rgba(244,243,239,0.45)" }), marginTop: 6 }}>{tx.name}</div>
      </div>

      <div style={{ padding: "18px 20px 8px", display: "grid", gap: 10 }}>
        <StatRow label="Owed" value={`$${formatAmount(owed)}`} />
        <StatRow label="Settled" value={`$${formatAmount(settled)}`} muted />
        <StatRow
          label="Outstanding"
          value={`$${formatAmount(outstanding)}`}
          accent={outstanding > 0}
        />
      </div>

      <div style={{ padding: "18px 20px 8px" }}>
        <div style={mono(10, 600, { letterSpacing: 2, textTransform: "uppercase", color: "rgba(244,243,239,0.4)" })}>
          Payments
        </div>
        {loading && (
          <div style={{ ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }), padding: "16px 0" }}>Loading…</div>
        )}
        {!loading && paybacks.length === 0 && (
          <div style={{ ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }), padding: "16px 0" }}>
            No payments linked yet
          </div>
        )}
        {paybacks.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 0",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <TxAvatar name={p.name} logoUrl={p.logoUrl} color="#C73DF4" size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...serif(15, 400, { color: TEXT }), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name}
              </div>
              <div style={mono(11, 400, { color: "rgba(244,243,239,0.38)" })}>
                {p.date} · {p.accountName}
              </div>
            </div>
            <div style={{ textAlign: "right", flex: "none" }}>
              <div style={mono(13, 500, { color: ACCENT })}>+${formatAmount(p.amount)}</div>
              <button
                type="button"
                onClick={() => unlink(p)}
                disabled={unlinkingId === p.id}
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px 0 0",
                  cursor: unlinkingId === p.id ? "wait" : "pointer",
                  ...mono(10, 600, { color: "rgba(244,243,239,0.35)", letterSpacing: 0.5 }),
                }}
              >
                {unlinkingId === p.id ? "…" : "Unlink"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ textAlign: "center", padding: "0 20px 8px", ...mono(12, 500, { color: "#D98A7F" }) }}>
          {error}
        </div>
      )}

      <div style={{ padding: "12px 20px 28px", display: "grid", gap: 10 }}>
        {outstanding > 0 && (
          <button
            type="button"
            onClick={onLinkPayment}
            style={{
              width: "100%",
              padding: "16px 0",
              borderRadius: 14,
              border: "none",
              cursor: "pointer",
              background: "#6B8AB0",
              ...mono(14, 700, { letterSpacing: 1.5, color: TEXT, textTransform: "uppercase" }),
            }}
          >
            Link payment
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer",
            background: "transparent",
            ...mono(13, 600, { letterSpacing: 1, color: "rgba(244,243,239,0.55)", textTransform: "uppercase" }),
          }}
        >
          Done
        </button>
      </div>
    </Sheet>
  );
}

function StatRow({
  label,
  value,
  muted,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "10px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <span style={mono(11, 600, { letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(244,243,239,0.4)" })}>
        {label}
      </span>
      <span
        style={mono(15, 500, {
          color: accent ? ACCENT : muted ? "rgba(244,243,239,0.55)" : TEXT,
        })}
      >
        {value}
      </span>
    </div>
  );
}
