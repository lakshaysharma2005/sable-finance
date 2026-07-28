"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/components/Sheet";
import type { TxItem } from "@/lib/queries";
import { ACCENT, mono, serif, TEXT } from "@/lib/ui";

type Props = {
  tx: TxItem;
  onClose: () => void;
  onSaved: (tx: TxItem) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const d = new Date(y, m - 1 + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

type Cell = { iso: string; day: number; inMonth: boolean };

function buildCells(y: number, m: number): Cell[] {
  const firstDow = new Date(y, m - 1, 1).getDay();
  const dim = daysInMonth(y, m);
  const prev = shiftMonth(y, m, -1);
  const prevDim = daysInMonth(prev.y, prev.m);
  const next = shiftMonth(y, m, 1);

  const cells: Cell[] = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    const day = prevDim - i;
    cells.push({ iso: toIso(prev.y, prev.m, day), day, inMonth: false });
  }
  for (let day = 1; day <= dim; day++) {
    cells.push({ iso: toIso(y, m, day), day, inMonth: true });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ iso: toIso(next.y, next.m, nextDay), day: nextDay, inMonth: false });
    nextDay++;
    if (cells.length >= 42) break;
  }
  return cells;
}

export function EditDateSheet({ tx, onClose, onSaved }: Props) {
  const initial = parseIso(tx.date);
  const [viewY, setViewY] = useState(initial.y);
  const [viewM, setViewM] = useState(initial.m);
  const [selected, setSelected] = useState(tx.date);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cells = useMemo(() => buildCells(viewY, viewM), [viewY, viewM]);
  const prev = shiftMonth(viewY, viewM, -1);
  const next = shiftMonth(viewY, viewM, 1);
  const canSave = selected !== tx.date && !saving;

  function goMonth(delta: number) {
    const n = shiftMonth(viewY, viewM, delta);
    setViewY(n.y);
    setViewM(n.m);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${tx.id}/date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      onSaved({ ...tx, date: data.date });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet onClose={onClose} background="#161618" zIndex={25}>
      <div style={{ textAlign: "center", padding: "4px 20px 8px" }}>
        <div style={mono(10, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: "#6B8AB0" })}>
          Edit date
        </div>
        <div style={{ ...serif(22, 400, { color: TEXT }), marginTop: 10 }}>{tx.name}</div>
      </div>

      <div style={{ padding: "18px 16px 8px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            marginBottom: 18,
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label="Previous month"
            style={{
              background: "none",
              border: "none",
              padding: "6px 4px",
              ...serif(15, 400, { color: "rgba(244,243,239,0.28)", textAlign: "right" }),
              cursor: "pointer",
            }}
          >
            {MONTHS[prev.m - 1].slice(0, 3)}
          </button>
          <div style={serif(20, 400, { color: TEXT, textAlign: "center", minWidth: 110, lineHeight: 1.15 })}>
            {MONTHS[viewM - 1]}
            <div style={mono(10, 400, { color: "rgba(244,243,239,0.32)", marginTop: 2, letterSpacing: 1 })}>
              {viewY}
            </div>
          </div>
          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="Next month"
            style={{
              background: "none",
              border: "none",
              padding: "6px 4px",
              ...serif(15, 400, { color: "rgba(244,243,239,0.28)", textAlign: "left" }),
              cursor: "pointer",
            }}
          >
            {MONTHS[next.m - 1].slice(0, 3)}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            marginBottom: 8,
          }}
        >
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                padding: "6px 0",
                ...mono(11, 400, { color: "rgba(244,243,239,0.38)" }),
              }}
            >
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 4 }}>
          {cells.map((cell) => {
            const isSelected = cell.iso === selected;
            return (
              <button
                key={cell.iso + (cell.inMonth ? "" : "-o")}
                type="button"
                onClick={() => {
                  setSelected(cell.iso);
                  if (!cell.inMonth) {
                    const p = parseIso(cell.iso);
                    setViewY(p.y);
                    setViewM(p.m);
                  }
                }}
                style={{
                  height: 44,
                  border: "none",
                  background: "none",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isSelected ? ACCENT : "transparent",
                    ...mono(15, isSelected ? 600 : 400, {
                      color: isSelected
                        ? "#0D0D0F"
                        : cell.inMonth
                          ? TEXT
                          : "rgba(244,243,239,0.22)",
                    }),
                  }}
                >
                  {cell.day}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ textAlign: "center", padding: "0 20px 8px", ...mono(12, 500, { color: "#D98A7F" }) }}>
          {error}
        </div>
      )}

      <div style={{ padding: "12px 20px 28px" }}>
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
