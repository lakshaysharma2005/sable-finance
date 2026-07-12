"use client";

import { useState } from "react";
import { AddCategorySheet } from "@/components/AddCategorySheet";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Sheet } from "@/components/Sheet";
import type { CategoriesListData } from "@/lib/category-queries";
import { CATEGORY_COLORS } from "@/lib/categories";
import { MINUS } from "@/lib/format";
import type { TxItem } from "@/lib/queries";
import { ACCENT, microLabel, mono, serif, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";

type Props = {
  tx: TxItem | null;
  onClose: () => void;
  onTxUpdate: (tx: TxItem) => void;
  onCategoryChanged?: () => void;
};

export function TransactionDetailSheets({ tx, onClose, onTxUpdate, onCategoryChanged }: Props) {
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [catChanged, setCatChanged] = useState<{ tx: TxItem; category: string } | null>(null);

  const { data: categoriesData, reload: reloadCategories } = useData<CategoriesListData>("/api/categories");

  async function changeCategory(category: string) {
    if (!tx) return;
    const catMeta = categoriesData?.categories.find((c) => c.name === category);
    await fetch(`/api/transactions/${tx.id}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    setCatPickerOpen(false);
    setCatChanged({ tx, category });
    onTxUpdate({
      ...tx,
      category,
      emoji: catMeta?.emoji ?? tx.emoji,
      color: catMeta?.color ?? CATEGORY_COLORS[category] ?? tx.color,
    });
    onCategoryChanged?.();
  }

  async function createRule() {
    if (!catChanged) return;
    await fetch(`/api/transactions/${catChanged.tx.id}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: catChanged.category, createRule: true }),
    });
    setCatChanged(null);
    onCategoryChanged?.();
  }

  function handleClose() {
    setCatPickerOpen(false);
    setCatChanged(null);
    onClose();
  }

  if (!tx) return null;

  return (
    <>
      {!catPickerOpen && !catChanged && (
        <Sheet onClose={handleClose}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px 12px" }}>
            <div>
              <div style={mono(10, 600, { letterSpacing: 2, textTransform: "uppercase", color: ACCENT })}>Transaction</div>
              <div style={mono(10, 400, { color: "rgba(244,243,239,0.38)", marginTop: 3 })}>
                {new Date(tx.date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center", padding: "10px 20px 6px" }}>
            <div style={{ marginBottom: 16 }}>
              <span style={serif(32, 400, { color: TEXT })}>{tx.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2, marginBottom: 16 }}>
              <span style={mono(22, 500, { color: "rgba(244,243,239,0.4)" })}>
                {tx.amount < 0 ? "+" : MINUS}$
              </span>
              <span style={mono(46, 500, { color: TEXT, letterSpacing: -2 })}>
                {Math.abs(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div style={{ padding: "22px 20px 16px" }}>
            <div style={{ ...microLabel, fontWeight: 600, letterSpacing: 2, textAlign: "center", marginBottom: 12 }}>
              Category
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => setCatPickerOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  background: tx.color + "22",
                  borderRadius: 999,
                  padding: "11px 22px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <CategoryIcon emoji={tx.emoji} color={tx.color} size="md" />
                <span style={mono(12, 700, { letterSpacing: 1, color: tx.color })}>{tx.category}</span>
              </button>
            </div>
          </div>
          <div style={{ padding: "0 20px 28px", display: "flex", justifyContent: "center" }}>
            <div
              style={{
                borderRadius: 14,
                padding: "12px 14px",
                background: tx.accountColor + "18",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                width: 130,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={mono(9, 700, { color: tx.accountColor, letterSpacing: 1 })}>
                  {tx.accountName.toUpperCase().slice(0, 12)}
                </span>
                <span
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: "50%",
                    background: tx.accountColor,
                    opacity: 0.85,
                    flex: "none",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={mono(13, 500, { color: "rgba(244,243,239,0.65)" })}>••{tx.accountMask ?? "????"}</span>
              </div>
            </div>
          </div>
        </Sheet>
      )}

      {catPickerOpen && (
        <Sheet onClose={() => setCatPickerOpen(false)} background="#161618" zIndex={25}>
          <div
            style={{
              textAlign: "center",
              ...mono(11, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: ACCENT }),
              padding: "6px 0 10px",
            }}
          >
            Change category
          </div>
          {categoriesData?.categories.map((c) => (
            <div
              key={c.name}
              onClick={() => changeCategory(c.name)}
              style={{
                padding: "15px 24px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
              }}
            >
              <CategoryIcon emoji={c.emoji} color={c.color} size="md" />
              <span style={serif(16, 400, { color: c.name === tx.category ? ACCENT : TEXT })}>{c.name}</span>
              {c.name === tx.category && <span style={mono(13, 600, { color: ACCENT })}>✓</span>}
            </div>
          ))}
          <div
            onClick={() => {
              setCatPickerOpen(false);
              setAddCategoryOpen(true);
            }}
            style={{
              padding: "15px 24px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <span style={serif(16, 400, { color: "#6B8AB0" })}>Add a category</span>
          </div>
          <div style={{ paddingBottom: 18 }} />
        </Sheet>
      )}

      {addCategoryOpen && (
        <AddCategorySheet
          onClose={() => setAddCategoryOpen(false)}
          onCreated={() => {
            reloadCategories();
            onCategoryChanged?.();
          }}
        />
      )}

      {catChanged && (
        <Sheet onClose={() => setCatChanged(null)} zIndex={30} style={{ padding: "0 24px 34px" }}>
          <div style={{ textAlign: "center", ...mono(15, 700, { letterSpacing: 1.5, color: "#6B8AB0" }) }}>
            CATEGORY CHANGED
          </div>
          <div
            style={{
              textAlign: "center",
              ...serif(18, 400, { color: "rgba(140,163,196,0.75)", lineHeight: 1.4, marginTop: 16 }),
            }}
          >
            Do you want to apply the same change to similar transactions?
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 36 }}>
            <button
              onClick={createRule}
              style={{ background: "none", border: "none", padding: "14px 0", ...serif(18, 400, { color: TEXT }), cursor: "pointer" }}
            >
              Create a rule based on the name
            </button>
            <button
              onClick={() => setCatChanged(null)}
              style={{
                background: "none",
                border: "none",
                padding: "14px 0 4px",
                ...serif(18, 400, { color: "rgba(244,243,239,0.45)" }),
                cursor: "pointer",
              }}
            >
              No thanks
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
