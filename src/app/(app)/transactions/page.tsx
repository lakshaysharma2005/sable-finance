"use client";

import { useMemo, useState } from "react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { FilterIcon } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { TransactionDetailSheets } from "@/components/TransactionDetailSheets";
import { TxAvatar } from "@/components/TxAvatar";
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
                  <div style={{ ...microLabel, letterSpacing: 0.5, color: "rgba(244,243,239,0.5)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                    <CategoryIcon emoji={it.emoji} color={it.color} size="sm" />
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

      <TransactionDetailSheets
        tx={selectedTx}
        onClose={() => setSelectedTx(null)}
        onTxUpdate={setSelectedTx}
        onCategoryChanged={reload}
      />

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
