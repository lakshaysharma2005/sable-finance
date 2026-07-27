"use client";

import { useState } from "react";
import { AmountDisplay } from "@/components/AmountDisplay";
import { Sheet } from "@/components/Sheet";
import { AMOUNT_KEYS, applyAmountKey, formatAmtDisplay } from "@/lib/amount-input";
import { MINUS } from "@/lib/format";
import type { TxItem } from "@/lib/queries";
import { ACCENT, mono, serif, TEXT } from "@/lib/ui";

type Props = {
  tx: TxItem;
  onClose: () => void;
  onSaved: (tx: TxItem) => void;
};

export function EditAmountSheet({ tx, onClose, onSaved }: Props) {
  const isInflow = tx.amount < 0;
  const [amt, setAmt] = useState(() => Math.abs(tx.amount).toFixed(2).replace(/\.?0+$/, "") || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseFloat(amt);
  const canSave = Number.isFinite(parsed) && parsed > 0 && !saving;
  const display = formatAmtDisplay(amt);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${tx.id}/amount`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      onSaved({
        ...tx,
        amount: data.amount,
        originalAmount: data.originalAmount,
        excludedAmount: data.excludedAmount,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet onClose={onClose} background="#161618" zIndex={25}>
      <div style={{ textAlign: "center", padding: "4px 20px 8px" }}>
        <div style={mono(10, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: "#6B8AB0" })}>
          Edit amount
        </div>
        <div style={{ ...serif(18, 400, { color: TEXT }), marginTop: 10 }}>{tx.name}</div>
      </div>

      <div style={{ textAlign: "center", padding: "18px 20px 14px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 3 }}>
          <span style={mono(24, 500, { color: "rgba(244,243,239,0.4)" })}>{isInflow ? "+$" : `${MINUS}$`}</span>
          <AmountDisplay raw={display} size={54} letterSpacing={-2} />
        </div>
      </div>

      {error && (
        <div style={{ textAlign: "center", padding: "0 20px 8px", ...mono(12, 500, { color: "#D98A7F" }) }}>{error}</div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6,
          padding: "0 20px 14px",
        }}
      >
        {AMOUNT_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAmt((v) => applyAmountKey(v, k))}
            style={{
              height: 58,
              borderRadius: 16,
              border: "none",
              background: "transparent",
              color: TEXT,
              ...mono(22, 500),
              cursor: "pointer",
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 20px 28px" }}>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          style={{
            width: "100%",
            padding: 17,
            borderRadius: 16,
            border: "none",
            ...mono(13, 600, { letterSpacing: 1.5, textTransform: "uppercase" }),
            background: canSave ? ACCENT : "rgba(255,255,255,0.06)",
            color: canSave ? "#0D0D0F" : "rgba(244,243,239,0.3)",
            cursor: canSave ? "pointer" : "default",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Sheet>
  );
}
