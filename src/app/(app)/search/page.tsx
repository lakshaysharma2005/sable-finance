"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { SearchIcon } from "@/components/Icons";
import { TransactionDetailSheets } from "@/components/TransactionDetailSheets";
import { TxAvatar } from "@/components/TxAvatar";
import type { CategoriesListData } from "@/lib/category-queries";
import { EXCLUDED_CATEGORIES } from "@/lib/categories";
import { MINUS, money } from "@/lib/format";
import type { TransactionsData, TxItem } from "@/lib/queries";
import { ACCENT, card, chipBase, chipOff, microLabel, mono, serif, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";

const RECENT_KEY = "sable-search-recent";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function dayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

function pushRecent(term: string): string[] {
  const t = term.trim();
  if (t.length < 2) return readRecent();
  const next = [t, ...readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export default function SearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: txData, reload } = useData<TransactionsData>("/api/transactions");
  const { data: categoriesData } = useData<CategoriesListData>("/api/categories");

  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [selectedTx, setSelectedTx] = useState<TxItem | null>(null);

  useEffect(() => {
    setRecent(readRecent());
    inputRef.current?.focus();
  }, []);

  const categories = useMemo(
    () =>
      (categoriesData?.categories ?? []).filter(
        (c) => !(EXCLUDED_CATEGORIES as readonly string[]).includes(c.name),
      ),
    [categoriesData],
  );

  const allTx = useMemo(() => txData?.groups.flatMap((g) => g.items) ?? [], [txData]);

  const sq = query.trim().toLowerCase();
  const hasQuery = sq.length > 0;

  const results = useMemo(() => {
    if (!hasQuery) return [];
    return allTx.filter((t) => {
      const hay = [t.name, t.merchantName ?? "", t.category, t.note ?? ""].join(" ").toLowerCase();
      return hay.includes(sq);
    });
  }, [allTx, hasQuery, sq]);

  const net = results.reduce((s, t) => s + t.amount, 0);
  // UI net: positive Plaid amount = spend; invert sign for display labeling like the prototype
  const netLabel =
    results.length > 0
      ? `${net >= 0 ? MINUS : "+"}${money(Math.abs(net))} net`
      : "";

  function setQueryAndRemember(value: string) {
    setQuery(value);
    if (value.trim().length >= 2) setRecent(pushRecent(value));
  }

  return (
    <div style={{ animation: "fadeUp .3s ease both" }}>
      {/* search bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: "#161618",
            border: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flex: "none",
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(244,243,239,0.6)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#161618",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "0 14px",
            height: 44,
          }}
        >
          <SearchIcon size={16} color="rgba(244,243,239,0.4)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => {
              if (query.trim().length >= 2) setRecent(pushRecent(query));
            }}
            placeholder="Search transactions"
            style={{
              flex: 1,
              minWidth: 0,
              background: "none",
              border: "none",
              outline: "none",
              color: TEXT,
              ...serif(15),
            }}
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...mono(11, 600, { color: "rgba(244,243,239,0.6)" }),
                cursor: "pointer",
                flex: "none",
                padding: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!hasQuery && (
        <>
          {recent.length > 0 && (
            <>
              <div style={{ ...microLabel, marginBottom: 10 }}>Recent</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                {recent.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setQueryAndRemember(label)}
                    style={{ ...chipBase, ...chipOff }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgba(244,243,239,0.35)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ ...microLabel, marginBottom: 10 }}>Browse categories</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {categories.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setQueryAndRemember(c.name)}
                style={{ ...chipBase, ...chipOff }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 3,
                    flex: "none",
                    background: c.color,
                  }}
                />
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}

      {hasQuery && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 10,
              padding: "0 2px",
            }}
          >
            <span style={mono(11, 400, { letterSpacing: 1, textTransform: "uppercase", color: "rgba(244,243,239,0.5)" })}>
              {results.length} {results.length === 1 ? "result" : "results"}
            </span>
            {netLabel && <span style={mono(13, 500, { color: TEXT })}>{netLabel}</span>}
          </div>

          {results.length > 0 ? (
            <div data-rows="1" style={{ ...card, borderRadius: 18, overflow: "hidden" }}>
              {results.map((it) => (
                <div
                  key={it.id}
                  onClick={() => {
                    setRecent(pushRecent(query));
                    setSelectedTx(it);
                  }}
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
                    <div
                      style={{
                        ...microLabel,
                        letterSpacing: 0.5,
                        color: "rgba(244,243,239,0.5)",
                        marginTop: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <CategoryIcon emoji={it.emoji} color={it.color} size="sm" />
                      {dayLabel(it.date)} · {it.category}
                    </div>
                  </div>
                  <div style={mono(15, 500, { color: it.amount < 0 ? ACCENT : TEXT, flex: "none" })}>
                    {it.amount < 0 ? `+${money(-it.amount)}` : `${MINUS}${money(it.amount)}`}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                ...card,
                borderRadius: 18,
                padding: "28px 22px",
                textAlign: "center",
                marginTop: 6,
              }}
            >
              <div style={serif(16, 400, { color: "rgba(244,243,239,0.6)" })}>Nothing found</div>
              <div style={mono(11, 400, { color: "rgba(244,243,239,0.32)", marginTop: 6 })}>
                Try a merchant, category, or note
              </div>
            </div>
          )}
        </>
      )}

      <TransactionDetailSheets
        tx={selectedTx}
        onClose={() => setSelectedTx(null)}
        onTxUpdate={setSelectedTx}
        onCategoryChanged={reload}
      />
    </div>
  );
}
