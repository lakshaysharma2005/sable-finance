"use client";

import { useMemo, useState } from "react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Sheet } from "@/components/Sheet";
import { CATEGORY_COLORS } from "@/lib/categories";
import type { TxItem } from "@/lib/queries";
import { SPLITS_CATEGORY } from "@/lib/queries";
import { ACCENT, mono, serif, TEXT } from "@/lib/ui";

type SplitRow = { key: string; amount: string };

type Props = {
  tx: TxItem;
  onClose: () => void;
  onSaved: (tx: TxItem) => void;
};

function parseAmount(value: string): number {
  const n = parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeInput(value: string): string {
  let v = value.replace(/[^0-9.]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  if (parts.length === 2 && parts[1].length > 2) v = parts[0] + "." + parts[1].slice(0, 2);
  return v;
}

let rowKey = 0;
function newRow(amount = ""): SplitRow {
  return { key: `split-${++rowKey}`, amount };
}

export function SplitTransactionSheet({ tx, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<SplitRow[]>(() =>
    tx.splits.length > 0 ? tx.splits.map((s) => newRow(s.amount.toFixed(2))) : [newRow()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const splitsColor = CATEGORY_COLORS[SPLITS_CATEGORY] ?? "#9C51F6";
  const splitsEmoji = "🤝";

  const splitTotal = useMemo(() => rows.reduce((sum, r) => sum + parseAmount(r.amount), 0), [rows]);
  const remaining = Math.max(0, tx.originalAmount - splitTotal);
  const canSave = splitTotal > 0 && splitTotal <= tx.originalAmount && !saving;

  function updateRow(key: string, amount: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount: normalizeInput(amount) } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const splits = rows
        .map((r) => ({ amount: parseAmount(r.amount) }))
        .filter((s) => s.amount > 0);

      const res = await fetch(`/api/transactions/${tx.id}/splits`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ splits }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }

      onSaved({
        ...tx,
        amount: data.effectiveAmount,
        originalAmount: data.originalAmount,
        excludedAmount: data.excludedAmount,
        splits: data.splits,
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
          Split transaction
        </div>
        <div style={{ ...serif(22, 400, { color: TEXT }), marginTop: 10 }}>{tx.name}</div>
        <div style={{ ...mono(14, 500, { color: "rgba(244,243,239,0.55)" }), marginTop: 6 }}>
          ${formatAmount(tx.originalAmount)}
        </div>
      </div>

      <div style={{ margin: "16px 20px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {/* Main row — your share */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 0",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span style={mono(16, 500, { color: TEXT })}>${formatAmount(remaining)}</span>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: tx.color + "22",
              borderRadius: 999,
              padding: "8px 16px",
            }}
          >
            <CategoryIcon emoji={tx.emoji} color={tx.color} size="sm" />
            <span style={mono(10, 700, { letterSpacing: 1, color: tx.color, textTransform: "uppercase" })}>
              {tx.category}
            </span>
          </div>
        </div>

        {/* Split rows */}
        {rows.map((row) => (
          <div
            key={row.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "16px 0",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={row.amount}
              onChange={(e) => updateRow(row.key, e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                ...mono(16, 500, { color: row.amount ? TEXT : "rgba(244,243,239,0.3)" }),
                minWidth: 0,
              }}
            />
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: splitsColor + "22",
                borderRadius: 999,
                padding: "8px 16px",
                flex: "none",
              }}
            >
              <CategoryIcon emoji={splitsEmoji} color={splitsColor} size="sm" />
              <span style={mono(10, 700, { letterSpacing: 1, color: splitsColor, textTransform: "uppercase" })}>
                {SPLITS_CATEGORY}
              </span>
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px 6px",
                  cursor: "pointer",
                  ...mono(14, 500, { color: "rgba(244,243,239,0.4)" }),
                  flex: "none",
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "14px 0 8px" }}>
        <button
          type="button"
          onClick={addRow}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            ...mono(13, 600, { color: "#6B8AB0" }),
          }}
        >
          + add
        </button>
      </div>

      {error && (
        <div style={{ textAlign: "center", padding: "0 20px 8px", ...mono(12, 500, { color: "#D98A7F" }) }}>
          {error}
        </div>
      )}

      <div style={{ padding: "8px 20px 28px" }}>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          style={{
            width: "100%",
            padding: "16px 0",
            borderRadius: 14,
            border: "none",
            cursor: canSave ? "pointer" : "not-allowed",
            background: canSave ? "#6B8AB0" : "rgba(107,138,176,0.35)",
            ...mono(14, 700, { letterSpacing: 1.5, color: TEXT, textTransform: "uppercase" }),
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Sheet>
  );
}
