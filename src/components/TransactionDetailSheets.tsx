"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AmountDisplay } from "@/components/AmountDisplay";
import { AddCategorySheet } from "@/components/AddCategorySheet";
import { AccountMiniCard } from "@/components/AccountMiniCard";
import { CategoryIcon } from "@/components/CategoryIcon";
import { EditAmountSheet } from "@/components/EditAmountSheet";
import { EditDateSheet } from "@/components/EditDateSheet";
import { DotsIcon } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { SplitTransactionSheet } from "@/components/SplitTransactionSheet";
import type { CategoriesListData } from "@/lib/category-queries";
import { CATEGORY_COLORS } from "@/lib/categories";
import { MINUS, money } from "@/lib/format";
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
  const router = useRouter();
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [amountEditOpen, setAmountEditOpen] = useState(false);
  const [dateEditOpen, setDateEditOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [catChanged, setCatChanged] = useState<{ tx: TxItem; category: string } | null>(null);
  const [excludeSaving, setExcludeSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: categoriesData, reload: reloadCategories } = useData<CategoriesListData>("/api/categories");

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  async function toggleExclude() {
    if (!tx || excludeSaving) return;
    setMenuOpen(false);
    setExcludeSaving(true);
    const next = !tx.excludedFromSpending;
    try {
      await fetch(`/api/transactions/${tx.id}/exclude`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excluded: next }),
      });
      onTxUpdate({ ...tx, excludedFromSpending: next });
      onCategoryChanged?.();
    } finally {
      setExcludeSaving(false);
    }
  }

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
    setSplitOpen(false);
    setAmountEditOpen(false);
    setDateEditOpen(false);
    setCatChanged(null);
    setMenuOpen(false);
    onClose();
  }

  if (!tx) return null;

  const canSplit = tx.originalAmount > 0;
  const showDetail = !catPickerOpen && !catChanged && !splitOpen && !amountEditOpen && !dateEditOpen;

  return (
    <>
      {showDetail && (
        <Sheet onClose={handleClose}>
          <div style={{ display: "flex", alignItems: "flex-start", padding: "0 16px 12px" }}>
            <div style={{ width: 36, flex: "none" }} />
            <div style={{ flex: 1, textAlign: "center", paddingTop: 2 }}>
              <div style={mono(10, 600, { letterSpacing: 2, textTransform: "uppercase", color: ACCENT })}>Transaction</div>
              <button
                type="button"
                onClick={() => setDateEditOpen(true)}
                aria-label="Change transaction date"
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px 8px",
                  marginTop: 1,
                  cursor: "pointer",
                  ...mono(10, 400, { color: "rgba(244,243,239,0.38)" }),
                }}
              >
                {new Date(tx.date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </button>
            </div>
            <div ref={menuRef} style={{ position: "relative", width: 36, flex: "none" }}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Transaction options"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: menuOpen ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.06)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <DotsIcon />
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: 42,
                    right: 0,
                    background: "#202022",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 14,
                    padding: 6,
                    minWidth: 196,
                    boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
                    zIndex: 5,
                  }}
                >
                  {canSplit && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setSplitOpen(true);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        padding: "11px 12px",
                        borderRadius: 9,
                        ...serif(14, 400, { color: TEXT }),
                        cursor: "pointer",
                      }}
                    >
                      Split
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleExclude}
                    disabled={excludeSaving}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      padding: "11px 12px",
                      borderRadius: 9,
                      ...serif(14, 400, {
                        color: tx.excludedFromSpending ? ACCENT : TEXT,
                        opacity: excludeSaving ? 0.5 : 1,
                      }),
                      cursor: excludeSaving ? "wait" : "pointer",
                    }}
                  >
                    {excludeSaving
                      ? "Saving…"
                      : tx.excludedFromSpending
                        ? "Include in spending"
                        : "Exclude from spending"}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign: "center", padding: "10px 20px 6px" }}>
            <div style={{ marginBottom: 16 }}>
              <span style={serif(24, 400, { color: TEXT })}>{tx.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setAmountEditOpen(true)}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                gap: 2,
                marginBottom: tx.excludedAmount > 0 || tx.excludedFromSpending ? 6 : 16,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                width: "100%",
              }}
            >
              <span style={mono(18, 500, { color: "rgba(244,243,239,0.4)" })}>
                {tx.amount < 0 ? "+" : MINUS}$
              </span>
              <AmountDisplay amount={Math.abs(tx.amount)} size={34} letterSpacing={-2} />
            </button>
            {tx.excludedAmount > 0 && (
              <div style={{ ...mono(11, 400, { color: "rgba(244,243,239,0.32)" }), marginBottom: tx.excludedFromSpending ? 4 : 16 }}>
                Originally ${tx.originalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            )}
            {tx.excludedFromSpending && (
              <div style={{ ...mono(11, 400, { color: "rgba(244,243,239,0.32)" }), marginBottom: 16 }}>
                Excluded from spending
              </div>
            )}
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
                  padding: "7px 28px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <CategoryIcon emoji={tx.emoji} color={tx.color} size="md" />
                <span style={mono(12, 700, { letterSpacing: 1, color: tx.color })}>{tx.category}</span>
              </button>
            </div>
          </div>
          {tx.splits.length > 0 && (
            <div style={{ padding: "0 20px 20px" }}>
              <div style={{ ...microLabel, fontWeight: 600, letterSpacing: 2, textAlign: "center", marginBottom: 12 }}>
                Splits
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                {tx.splits.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "12px 14px",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      opacity: s.settledAt ? 0.5 : 1,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={serif(14, 400, {
                          color: TEXT,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        })}
                      >
                        {s.label?.trim() || "Unlabeled"}
                      </div>
                      <div style={mono(10, 500, { color: "rgba(244,243,239,0.35)", marginTop: 2 })}>
                        {s.settledAt ? "Settled" : "Open"}
                      </div>
                    </div>
                    <div style={mono(13, 500, { color: TEXT, flex: "none" })}>{money(s.amount)}</div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/owed");
                }}
                style={{
                  width: "100%",
                  marginTop: 12,
                  background: "none",
                  border: "none",
                  ...mono(11, 600, { letterSpacing: 1, color: "#6B8AB0", textTransform: "uppercase" }),
                  cursor: "pointer",
                  padding: "8px 0",
                }}
              >
                Track what&apos;s owed
              </button>
            </div>
          )}
          <div style={{ padding: "0 20px 28px", display: "flex", justifyContent: "center" }}>
            <AccountMiniCard name={tx.accountName} mask={tx.accountMask} color={tx.accountColor} />
          </div>
        </Sheet>
      )}

      {amountEditOpen && (
        <EditAmountSheet
          tx={tx}
          onClose={() => setAmountEditOpen(false)}
          onSaved={(updated) => {
            onTxUpdate(updated);
            onCategoryChanged?.();
          }}
        />
      )}

      {dateEditOpen && (
        <EditDateSheet
          tx={tx}
          onClose={() => setDateEditOpen(false)}
          onSaved={(updated) => {
            onTxUpdate(updated);
            onCategoryChanged?.();
          }}
        />
      )}

      {splitOpen && (
        <SplitTransactionSheet
          tx={tx}
          onClose={() => setSplitOpen(false)}
          onSaved={(updated) => {
            onTxUpdate(updated);
            onCategoryChanged?.();
          }}
        />
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
