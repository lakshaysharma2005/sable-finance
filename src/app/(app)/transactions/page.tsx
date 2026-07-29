"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { FilterIcon, SearchIcon } from "@/components/Icons";
import { TransactionDetailSheets } from "@/components/TransactionDetailSheets";
import { TransactionsFilterSheet, type TxSort } from "@/components/TransactionsFilterSheet";
import { TxAvatar } from "@/components/TxAvatar";
import { MINUS, money } from "@/lib/format";
import type { DayGroup, TransactionsData, TxItem } from "@/lib/queries";
import { isExcludedFromSpending } from "@/lib/queries";
import { ACCENT, card, chipBase, chipOff, chipOn, microLabel, mono, serif, TER, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function dayLabel(dateStr: string, today: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  const base = `${MONTHS[m - 1]} ${d}`;
  const t = new Date(today + "T00:00:00Z");
  const yesterday = new Date(t.getTime() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return `TODAY · ${base}`;
  if (dateStr === yesterday) return `YESTERDAY · ${base}`;
  return base;
}

function groupByDay(txs: TxItem[], today: string): DayGroup[] {
  const map = new Map<string, TxItem[]>();
  for (const tx of txs) {
    const list = map.get(tx.date) ?? [];
    list.push(tx);
    map.set(tx.date, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({
      date,
      label: dayLabel(date, today),
      net: -items.reduce((s, t) => s + (isExcludedFromSpending(t) ? 0 : t.amount), 0),
      items,
    }));
}

export default function TransactionsPage() {
  const router = useRouter();
  const [selAccts, setSelAccts] = useState<number[]>([]);
  const [selCategory, setSelCategory] = useState<string | null>(null);
  const [selMonth, setSelMonth] = useState<string | null>(null);
  const [sort, setSort] = useState<TxSort>("date");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TxItem | null>(null);

  const params = new URLSearchParams();
  if (selAccts.length > 0) params.set("accounts", selAccts.join(","));
  if (selMonth) params.set("month", selMonth);
  const query = params.toString() ? `?${params}` : "";
  const { data, reload } = useData<TransactionsData>(`/api/transactions${query}`);

  const allActive = selAccts.length === 0;
  const hasActiveFilters =
    selAccts.length > 0 || selCategory !== null || selMonth !== null || sort !== "date";

  function toggleAccount(id: number) {
    setSelAccts((cur) => {
      if (cur.length === 0) return [id];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return next.length === (data?.accounts.length ?? 0) ? [] : next;
    });
  }

  function resetAllFilters() {
    setSelAccts([]);
    setSelCategory(null);
    setSelMonth(null);
    setSort("date");
  }

  const filteredItems = useMemo(() => {
    if (!data) return [];
    let items = data.groups.flatMap((g) => g.items);
    if (selCategory) {
      items = items.filter((t) => t.category === selCategory);
    }
    return items;
  }, [data, selCategory]);

  const today = new Date().toISOString().slice(0, 10);

  const groups = useMemo(() => {
    if (!data) return [];
    if (sort === "date") return groupByDay(filteredItems, today);
    const sorted = [...filteredItems].sort((a, b) => (sort === "hl" ? b.amount - a.amount : a.amount - b.amount));
    return [{ date: "", label: "ALL · SORTED BY AMOUNT", net: 0, items: sorted }];
  }, [data, filteredItems, sort, today]);

  return (
    <div style={{ animation: "fadeUp .3s ease both" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={serif(22, 400, { color: TEXT })}>Transactions</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => router.push("/search")}
            aria-label="Search transactions"
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
            <SearchIcon />
          </button>
          <button
            onClick={() => setFilterOpen(true)}
            aria-label="Filter and sort"
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              background: hasActiveFilters ? `${ACCENT}18` : "#161618",
              border: `1px solid ${hasActiveFilters ? `${ACCENT}55` : "rgba(255,255,255,0.07)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <FilterIcon />
            {hasActiveFilters && (
              <span
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: ACCENT,
                }}
              />
            )}
          </button>
        </div>
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
              {a.name}{a.mask ? ` ••${a.mask}` : ""}
            </button>
          );
        })}
      </div>

      {/* list */}
      {groups.map((g) => (
        <div key={g.label} style={{ marginTop: 22 }}>
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
                  opacity: it.excludedFromSpending ? 0.48 : 1,
                }}
              >
                <TxAvatar name={it.name} color={it.color} logoUrl={it.logoUrl} accountName={it.accountName} />
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
                    {it.category}
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
      {data && groups.length === 0 && (
        <div style={{ marginTop: 24, textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
          {selCategory || selMonth ? "No transactions match your filters" : "No transactions in the last 90 days"}
        </div>
      )}

      <TransactionDetailSheets
        tx={selectedTx}
        onClose={() => setSelectedTx(null)}
        onTxUpdate={setSelectedTx}
        onCategoryChanged={reload}
      />

      <TransactionsFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        sort={sort}
        onSortChange={setSort}
        selAccts={selAccts}
        onSelAcctsChange={setSelAccts}
        selCategory={selCategory}
        onSelCategoryChange={setSelCategory}
        selMonth={selMonth}
        onSelMonthChange={setSelMonth}
        accounts={data?.accounts ?? []}
        hasActiveFilters={hasActiveFilters}
        onResetAll={resetAllFilters}
      />
    </div>
  );
}
