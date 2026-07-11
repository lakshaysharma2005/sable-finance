"use client";

import { useParams, useRouter } from "next/navigation";
import { TxAvatar } from "@/components/TxAvatar";
import { ChevronRightIcon } from "@/components/Icons";
import { MINUS, money } from "@/lib/format";
import type { CategoryData } from "@/lib/queries";
import { card, microLabel, mono, serif, TER, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const rawName = params.name;
  const name = decodeURIComponent(Array.isArray(rawName) ? rawName[0] : (rawName ?? ""));
  const { data, loading, error } = useData<CategoryData>(`/api/categories/${encodeURIComponent(name)}`);

  if (loading && !data) {
    return (
      <div style={{ padding: 48, textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
        Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <div style={serif(14, 400, { color: "rgba(244,243,239,0.4)", marginBottom: 16 })}>
          {error ? "Could not load this category" : "Category not found"}
        </div>
        <button
          onClick={() => router.back()}
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: "rgba(244,243,239,0.5)",
            ...mono(11, 600, { letterSpacing: 1 }),
            padding: "8px 14px",
            borderRadius: 9,
            cursor: "pointer",
          }}
        >
          Go back
        </button>
      </div>
    );
  }

  const groups = data.groups ?? [];
  const monthSpent = data.monthSpent ?? 0;

  return (
    <div style={{ animation: "fadeUp .3s ease both", paddingBottom: 24 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <button
          onClick={() => router.back()}
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
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
            <ChevronRightIcon color="rgba(244,243,239,0.6)" />
          </span>
        </button>
        <div style={mono(10, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: data.color ?? TER })}>
          Category
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* category title */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: (data.color ?? "#8A8594") + "22",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <span style={{ width: 16, height: 16, borderRadius: 5, background: data.color ?? "#8A8594" }} />
        </div>
        <div style={serif(28, 400, { color: data.color ?? TEXT })}>{name}</div>
      </div>

      {/* spent */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ ...microLabel, color: (data.color ?? TER) + "aa", marginBottom: 8 }}>Spent</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 }}>
          <span style={mono(22, 500, { color: TER })}>$</span>
          <span style={mono(46, 500, { color: TEXT, letterSpacing: -2 })}>
            {Math.floor(monthSpent).toLocaleString("en-US")}
          </span>
          <span style={mono(22, 500, { color: TER })}>.{monthSpent.toFixed(2).split(".")[1]}</span>
        </div>
        <div style={mono(13, 400, { color: TER, marginTop: 6 })}>spent in {data.monthName ?? "this month"}</div>
      </div>

      {/* key metrics */}
      <div style={{ ...card, padding: "18px 20px", marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ ...microLabel, color: data.color ?? TER }}>Key metrics</div>
          <div style={mono(11, 500, { color: TER })}>{data.year ?? new Date().getFullYear()}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={serif(15, 400, { color: "rgba(244,243,239,0.6)" })}>Total spend this year</span>
          <span style={mono(15, 500, { color: TEXT })}>{money(data.yearTotal ?? 0, 2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={serif(15, 400, { color: "rgba(244,243,239,0.6)" })}>Average per month</span>
          <span style={mono(15, 500, { color: TEXT })}>{money(data.yearAvg ?? 0, 2)}</span>
        </div>
      </div>

      {/* transactions */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "0 2px" }}>
          <div style={{ ...microLabel, color: data.color ?? TER }}>Transactions</div>
          <span style={mono(11, 400, { color: TER })}>{data.txCount ?? 0} total</span>
        </div>

        {groups.length === 0 && (
          <div style={{ ...card, borderRadius: 18, padding: 24, textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
            No transactions in this category
          </div>
        )}

        {groups.map((g) => (
          <div key={g.monthKey} style={{ marginBottom: 20 }}>
            <div style={{ ...serif(16, 400, { color: TEXT }), marginBottom: 10, padding: "0 2px" }}>{g.label}</div>
            <div data-rows="1" style={{ ...card, borderRadius: 18, overflow: "hidden" }}>
              {(g.items ?? []).map((it) => {
                const [, m, d] = it.date.split("-").map(Number);
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const dateLabel = `${months[m - 1]} ${d}`;
                return (
                  <div
                    key={it.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 14px",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span style={{ ...mono(11, 500, { color: (data.color ?? TER) + "cc" }), flex: "none", width: 42 }}>
                      {dateLabel}
                    </span>
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
                    </div>
                    <div style={mono(14, 500, { color: it.amount < 0 ? "#7FE08A" : TEXT, flex: "none" })}>
                      {it.amount < 0 ? `+${money(-it.amount)}` : `${MINUS}${money(it.amount)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
