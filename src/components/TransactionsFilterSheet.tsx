"use client";

import { useState } from "react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { AccountMiniCard } from "@/components/AccountMiniCard";
import { Sheet } from "@/components/Sheet";
import type { CategoriesListData } from "@/lib/category-queries";
import { EXCLUDED_CATEGORIES } from "@/lib/categories";
import type { TransactionsData } from "@/lib/queries";
import { ACCENT, mono, serif, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";

export type TxSort = "date" | "hl" | "lh";
type SubPanel = "account" | "category" | "month";

type Props = {
  open: boolean;
  onClose: () => void;
  sort: TxSort;
  onSortChange: (sort: TxSort) => void;
  selAccts: number[];
  onSelAcctsChange: (ids: number[]) => void;
  selCategory: string | null;
  onSelCategoryChange: (category: string | null) => void;
  selMonth: string | null;
  onSelMonthChange: (month: string | null) => void;
  accounts: TransactionsData["accounts"];
  hasActiveFilters: boolean;
  onResetAll: () => void;
};

const SORT_OPTIONS: { key: TxSort; label: string }[] = [
  { key: "date", label: "Sort by date" },
  { key: "hl", label: "Sort by amount (high to low)" },
  { key: "lh", label: "Sort by amount (low to high)" },
];

const rowStyle = {
  padding: "15px 24px",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
} as const;

const sectionHeader = {
  textAlign: "center" as const,
  ...mono(11, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: ACCENT }),
  padding: "6px 0 10px",
};

function monthsGroupedByYear(count = 24): { year: number; months: { key: string; label: string }[] }[] {
  const now = new Date();
  const groups = new Map<number, { key: string; label: string }[]>();

  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const key = `${year}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    const list = groups.get(year) ?? [];
    list.push({ key, label });
    groups.set(year, list);
  }

  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({ year, months }));
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

function YearDivider({ year }: { year: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 32px 10px" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(244,243,239,0.1)" }} />
      <span style={mono(11, 400, { color: "rgba(244,243,239,0.35)", letterSpacing: 1 })}>{year}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(244,243,239,0.1)" }} />
    </div>
  );
}

function accountSummary(selAccts: number[], total: number): string | null {
  if (selAccts.length === 0 || selAccts.length === total) return null;
  return `${selAccts.length} selected`;
}

function AccountFilterCard({
  account,
  selected,
  onToggle,
}: {
  account: TransactionsData["accounts"][number];
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <AccountMiniCard
      name={account.name}
      mask={account.mask}
      color={account.color}
      onClick={onToggle}
      style={{
        border: selected ? `2px solid ${ACCENT}` : "2px solid transparent",
      }}
    />
  );
}

export function TransactionsFilterSheet({
  open,
  onClose,
  sort,
  onSortChange,
  selAccts,
  onSelAcctsChange,
  selCategory,
  onSelCategoryChange,
  selMonth,
  onSelMonthChange,
  accounts,
  hasActiveFilters,
  onResetAll,
}: Props) {
  const [subPanel, setSubPanel] = useState<SubPanel | null>(null);
  const { data: categoriesData } = useData<CategoriesListData>("/api/categories");

  const categories = (categoriesData?.categories ?? []).filter(
    (c) => !(EXCLUDED_CATEGORIES as readonly string[]).includes(c.name),
  );

  const monthsByYear = monthsGroupedByYear();
  const acctHint = accountSummary(selAccts, accounts.length);
  const catHint = selCategory;
  const monthHint = selMonth ? monthLabelFromKey(selMonth) : null;

  function closeAll() {
    setSubPanel(null);
    onClose();
  }

  function toggleAccount(id: number) {
    onSelAcctsChange((() => {
      if (selAccts.length === 0) return [id];
      const next = selAccts.includes(id) ? selAccts.filter((x) => x !== id) : [...selAccts, id];
      return next.length === accounts.length ? [] : next;
    })());
  }

  function selectCategory(name: string | null) {
    onSelCategoryChange(name);
    closeAll();
  }

  function selectMonth(key: string) {
    onSelMonthChange(key);
    closeAll();
  }

  if (!open) return null;

  return (
    <>
      <Sheet onClose={closeAll} background="#161618">
        <div style={sectionHeader}>Filters</div>

        <div
          onClick={() => setSubPanel("account")}
          style={{ ...rowStyle, flexDirection: "column", gap: 4 }}
        >
          <span style={serif(16, 400, { color: TEXT })}>Filter by account</span>
          {acctHint && <span style={mono(10, 400, { color: ACCENT })}>{acctHint}</span>}
        </div>

        <div
          onClick={() => setSubPanel("category")}
          style={{ ...rowStyle, flexDirection: "column", gap: 4 }}
        >
          <span style={serif(16, 400, { color: TEXT })}>Filter by category</span>
          {catHint && <span style={mono(10, 400, { color: ACCENT })}>{catHint}</span>}
        </div>

        <div
          onClick={() => setSubPanel("month")}
          style={{ ...rowStyle, flexDirection: "column", gap: 4 }}
        >
          <span style={serif(16, 400, { color: TEXT })}>Filter by month</span>
          {monthHint && <span style={mono(10, 400, { color: ACCENT })}>{monthHint}</span>}
        </div>

        <div
          style={{
            ...sectionHeader,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            marginTop: 4,
            paddingTop: 18,
          }}
        >
          Sorting
        </div>

        {SORT_OPTIONS.map((s) => (
          <div
            key={s.key}
            onClick={() => {
              onSortChange(s.key);
              closeAll();
            }}
            style={rowStyle}
          >
            <span style={serif(16, 400, { color: sort === s.key ? ACCENT : TEXT })}>{s.label}</span>
            {sort === s.key && <span style={mono(13, 600, { color: ACCENT })}>✓</span>}
          </div>
        ))}
        {hasActiveFilters && (
          <div
            onClick={() => {
              onResetAll();
              closeAll();
            }}
            style={{
              padding: "15px 24px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              marginTop: 4,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <span style={serif(16, 400, { color: "rgba(244,243,239,0.45)" })}>Reset all filters</span>
          </div>
        )}
        <div style={{ paddingBottom: 24 }} />
      </Sheet>

      {subPanel === "account" && (
        <Sheet onClose={() => setSubPanel(null)} background="#161618" zIndex={25}>
          <div style={{ ...sectionHeader, paddingBottom: 14 }}>Accounts</div>
          <div style={{ padding: "0 20px 8px" }}>
            <button
              type="button"
              onClick={() => onSelAcctsChange([])}
              style={{
                width: "100%",
                padding: "12px 0",
                marginBottom: 14,
                borderRadius: 12,
                border: `1px solid ${selAccts.length === 0 ? ACCENT : "rgba(255,255,255,0.1)"}`,
                background: selAccts.length === 0 ? `${ACCENT}18` : "transparent",
                cursor: "pointer",
                ...mono(11, 500, { color: selAccts.length === 0 ? ACCENT : TEXT, letterSpacing: 0.5 }),
              }}
            >
              All accounts
            </button>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                justifyItems: "center",
              }}
            >
              {accounts.map((a) => (
                <AccountFilterCard
                  key={a.id}
                  account={a}
                  selected={selAccts.length > 0 && selAccts.includes(a.id)}
                  onToggle={() => toggleAccount(a.id)}
                />
              ))}
            </div>
          </div>
          <div style={{ paddingBottom: 24 }} />
        </Sheet>
      )}

      {subPanel === "category" && (
        <Sheet onClose={() => setSubPanel(null)} background="#161618" zIndex={25}>
          <div style={{ ...sectionHeader, paddingBottom: 6 }}>Categories</div>
          <div
            onClick={() => selectCategory(null)}
            style={rowStyle}
          >
            <span style={serif(16, 400, { color: selCategory === null ? ACCENT : TEXT })}>
              All categories
            </span>
            {selCategory === null && <span style={mono(13, 600, { color: ACCENT })}>✓</span>}
          </div>
          {categories.map((c) => {
            const active = selCategory === c.name;
            return (
              <div
                key={c.name}
                onClick={() => selectCategory(c.name)}
                style={rowStyle}
              >
                <CategoryIcon emoji={c.emoji} color={c.color} size="md" />
                <span style={serif(16, 400, { color: active ? ACCENT : TEXT })}>{c.name}</span>
                {active && <span style={mono(13, 600, { color: ACCENT })}>✓</span>}
              </div>
            );
          })}
          <div style={{ paddingBottom: 24 }} />
        </Sheet>
      )}

      {subPanel === "month" && (
        <Sheet onClose={() => setSubPanel(null)} background="#161618" zIndex={25}>
          <div style={{ ...sectionHeader, paddingBottom: 14 }}>Select a month</div>
          {monthsByYear.map((group) => (
            <div key={group.year}>
              <YearDivider year={group.year} />
              {group.months.map((m) => (
                <div
                  key={m.key}
                  onClick={() => selectMonth(m.key)}
                  style={{
                    padding: "13px 24px",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  <span style={serif(17, 400, { color: selMonth === m.key ? ACCENT : TEXT })}>{m.label}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ paddingBottom: 24 }} />
        </Sheet>
      )}
    </>
  );
}
