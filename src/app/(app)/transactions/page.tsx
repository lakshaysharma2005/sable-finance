"use client";

import { useMemo, useState } from "react";
import { FilterIcon } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { TxAvatar } from "@/components/TxAvatar";
import { CATEGORY_COLORS, SPEND_CATEGORIES } from "@/lib/categories";
import { MINUS, money } from "@/lib/format";
import type { TransactionsData, TxItem } from "@/lib/queries";
import { ACCENT, card, chipBase, chipOff, chipOn, microLabel, mono, serif, TER, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";

type Sort = "date" | "hl" | "lh";

export default function TransactionsPage() {
  const [selAccts, setSelAccts] = useState<number[]>([]);
  const [sort, setSort] = useState<Sort>("date");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TxItem | null>(null);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [catChanged, setCatChanged] = useState<{ tx: TxItem; category: string } | null>(null);

  const query = selAccts.length > 0 ? `?accounts=${selAccts.join(",")}` : "";
  const { data, reload } = useData<TransactionsData>(`/api/transactions${query}`);

  const allActive = selAccts.length === 0;

  function toggleAccount(id: number) {
    setSelAccts((cur) => {
      if (cur.length === 0) return [id];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return next.length === (data?.accounts.length ?? 0) ? [] : next;
    });
  }

  const groups = useMemo(() => {
    if (!data) return [];
    if (sort === "date") return data.groups;
    const flat = data.groups.flatMap((g) => g.items);
    // UI spend magnitude sorting on Plaid amounts (positive = outflow)
    const sorted = [...flat].sort((a, b) => (sort === "hl" ? b.amount - a.amount : a.amount - b.amount));
    return [{ date: "", label: "ALL · SORTED BY AMOUNT", net: 0, items: sorted }];
  }, [data, sort]);

  async function changeCategory(category: string) {
    if (!selectedTx) return;
    await fetch(`/api/transactions/${selectedTx.id}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    setCatPickerOpen(false);
    setCatChanged({ tx: selectedTx, category });
    setSelectedTx({ ...selectedTx, category, color: CATEGORY_COLORS[category] ?? selectedTx.color });
    reload();
  }

  async function createRule() {
    if (!catChanged) return;
    await fetch(`/api/transactions/${catChanged.tx.id}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: catChanged.category, createRule: true }),
    });
    setCatChanged(null);
    reload();
  }

  return (
    <div style={{ animation: "fadeUp .3s ease both" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={serif(22, 400, { color: TEXT })}>Transactions</div>
        <button
          onClick={() => setFilterOpen(true)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            background: "#161618",
            border: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <FilterIcon />
        </button>
      </div>

      {/* account selector */}
      <div style={{ ...microLabel, marginBottom: 9 }}>Showing accounts</div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        <button onClick={() => setSelAccts([])} style={{ ...chipBase, ...(allActive ? chipOn : chipOff) }}>
          All accounts
        </button>
        {data?.accounts.map((a) => {
          const active = !allActive && selAccts.includes(a.id);
          return (
            <button key={a.id} onClick={() => toggleAccount(a.id)} style={{ ...chipBase, ...(active ? chipOn : chipOff) }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, flex: "none", background: a.color }} />
              {a.name} ••{a.mask ?? "????"}
            </button>
          );
        })}
      </div>

      {/* summary */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginTop: 18,
          padding: "0 2px",
        }}
      >
        <span style={mono(11, 400, { letterSpacing: 1, textTransform: "uppercase", color: "rgba(244,243,239,0.5)" })}>
          {data?.txCount ?? 0} transactions
        </span>
        <span style={mono(13, 500, { color: TEXT })}>
          {MINUS}
          {money(data?.txSpent ?? 0)} spent
        </span>
      </div>

      {/* list */}
      {groups.map((g) => (
        <div key={g.label} style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, padding: "0 2px" }}>
            <span style={microLabel}>{g.label}</span>
            {g.date && <span style={mono(10, 400, { color: TER })}>{g.net < 0 ? MINUS : "+"}${money(Math.abs(g.net)).slice(1)}</span>}
          </div>
          <div data-rows="1" style={{ ...card, borderRadius: 18, overflow: "hidden" }}>
            {g.items.map((it) => (
              <div
                key={it.id}
                onClick={() => setSelectedTx(it)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 14px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  cursor: "pointer",
                }}
              >
                <TxAvatar name={it.name} color={it.color} logoUrl={it.logoUrl} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={serif(15, 400, {
                      color: TEXT,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    })}
                  >
                    {it.name}
                  </div>
                  <div style={{ ...microLabel, letterSpacing: 0.5, color: "rgba(244,243,239,0.5)", marginTop: 2 }}>
                    {it.category} · ••{it.accountMask ?? "????"}
                  </div>
                </div>
                <div style={{ textAlign: "right", flex: "none" }}>
                  <div style={mono(15, 500, { color: it.amount < 0 ? ACCENT : TEXT })}>
                    {it.amount < 0 ? `+${money(-it.amount)}` : `${MINUS}${money(it.amount)}`}
                  </div>
                  {it.pending && <div style={mono(9, 400, { color: TER, marginTop: 2 })}>Pending</div>}
                </div>
              </div>
            ))}
            {g.items.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
                No transactions
              </div>
            )}
          </div>
        </div>
      ))}
      {data && data.groups.length === 0 && (
        <div style={{ marginTop: 24, textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
          No transactions in the last 90 days
        </div>
      )}

      {/* transaction detail sheet */}
      {selectedTx && !catPickerOpen && !catChanged && (
        <Sheet onClose={() => setSelectedTx(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px 12px" }}>
            <div>
              <div style={mono(10, 600, { letterSpacing: 2, textTransform: "uppercase", color: ACCENT })}>Transaction</div>
              <div style={mono(10, 400, { color: "rgba(244,243,239,0.38)", marginTop: 3 })}>
                {new Date(selectedTx.date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center", padding: "10px 20px 6px" }}>
            <div style={{ marginBottom: 16 }}>
              <span style={serif(32, 400, { color: TEXT })}>{selectedTx.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2, marginBottom: 16 }}>
              <span style={mono(22, 500, { color: "rgba(244,243,239,0.4)" })}>
                {selectedTx.amount < 0 ? "+" : MINUS}$
              </span>
              <span style={mono(46, 500, { color: TEXT, letterSpacing: -2 })}>
                {Math.abs(selectedTx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
                  background: selectedTx.color + "22",
                  borderRadius: 999,
                  padding: "11px 22px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: selectedTx.color, flex: "none" }} />
                <span style={mono(12, 700, { letterSpacing: 1, color: selectedTx.color })}>{selectedTx.category}</span>
              </button>
            </div>
          </div>
          <div style={{ padding: "0 20px 28px", display: "flex", justifyContent: "center" }}>
            <div
              style={{
                borderRadius: 14,
                padding: "12px 14px",
                background: selectedTx.accountColor + "18",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                width: 130,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={mono(9, 700, { color: selectedTx.accountColor, letterSpacing: 1 })}>
                  {selectedTx.accountName.toUpperCase().slice(0, 12)}
                </span>
                <span
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: "50%",
                    background: selectedTx.accountColor,
                    opacity: 0.85,
                    flex: "none",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={mono(13, 500, { color: "rgba(244,243,239,0.65)" })}>••{selectedTx.accountMask ?? "????"}</span>
              </div>
            </div>
          </div>
        </Sheet>
      )}

      {/* category picker */}
      {catPickerOpen && selectedTx && (
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
          {SPEND_CATEGORIES.map((c) => (
            <div
              key={c}
              onClick={() => changeCategory(c)}
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
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: CATEGORY_COLORS[c], flex: "none" }} />
              <span style={serif(16, 400, { color: c === selectedTx.category ? ACCENT : TEXT })}>{c}</span>
              {c === selectedTx.category && <span style={mono(13, 600, { color: ACCENT })}>✓</span>}
            </div>
          ))}
          <div style={{ paddingBottom: 18 }} />
        </Sheet>
      )}

      {/* category changed confirmation */}
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

      {/* filter & sort sheet */}
      {filterOpen && (
        <Sheet onClose={() => setFilterOpen(false)} background="#161618">
          <div
            style={{
              textAlign: "center",
              ...mono(11, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: ACCENT }),
              padding: "6px 0 10px",
            }}
          >
            Sorting
          </div>
          {(
            [
              { key: "date", label: "Sort by date" },
              { key: "hl", label: "Sort by amount (high to low)" },
              { key: "lh", label: "Sort by amount (low to high)" },
            ] as { key: Sort; label: string }[]
          ).map((s) => (
            <div
              key={s.key}
              onClick={() => {
                setSort(s.key);
                setFilterOpen(false);
              }}
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
              <span style={serif(16, 400, { color: sort === s.key ? ACCENT : TEXT })}>{s.label}</span>
              {sort === s.key && <span style={mono(13, 600, { color: ACCENT })}>✓</span>}
            </div>
          ))}
          <div style={{ paddingBottom: 24 }} />
        </Sheet>
      )}
    </div>
  );
}
