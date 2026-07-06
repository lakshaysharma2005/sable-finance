"use client";

import { useState } from "react";
import { TxAvatar } from "@/components/TxAvatar";
import { MINUS, money } from "@/lib/format";
import type { StatsData, StatsRange } from "@/lib/queries";
import { ACCENT, card, microLabel, mono, serif, TER, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";

const RANGES: { key: StatsRange; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export default function StatsPage() {
  const [range, setRange] = useState<StatsRange>("month");
  const [tab, setTab] = useState<"top" | "excl">("top");
  const { data } = useData<StatsData>(`/api/stats?range=${range}`);

  return (
    <div style={{ animation: "fadeUp .3s ease both" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={serif(22, 400, { color: TEXT })}>Statistics</div>
      </div>

      {/* range toggle */}
      <div
        style={{
          display: "flex",
          gap: 5,
          background: "#161618",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 999,
          padding: 4,
        }}
      >
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            style={{
              flex: 1,
              padding: 9,
              borderRadius: 999,
              ...mono(11, 400, { letterSpacing: 1, textTransform: "uppercase" }),
              cursor: "pointer",
              border: "none",
              transition: "all .2s",
              background: r.key === range ? ACCENT : "transparent",
              color: r.key === range ? "#0D0D0F" : "rgba(244,243,239,0.5)",
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* bar chart card */}
      <div style={{ ...card, marginTop: 16, padding: "22px 18px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ ...microLabel, fontSize: 11, color: "rgba(244,243,239,0.5)" }}>{data?.periodLabel ?? ""}</div>
            <div style={mono(30, 500, { color: TEXT, marginTop: 8, letterSpacing: -1 })}>
              {data ? money(data.total, 2) : "$—"}
            </div>
          </div>
          {data && data.deltaPct > 0 && (
            <span
              style={{
                background: "rgba(127,224,138,0.12)",
                color: ACCENT,
                ...mono(11, 600),
                padding: "6px 10px",
                borderRadius: 8,
                marginTop: 4,
              }}
            >
              {data.deltaDir === "up" ? "▲" : "▼"} {data.deltaPct}% {data.compareLabel}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 9,
            height: 178,
            paddingTop: 34,
            marginTop: 8,
          }}
        >
          {data &&
            (() => {
              const maxv = Math.max(...data.vals, 1);
              return data.vals.map((v, i) => {
                const current = i === data.cur;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 9,
                      height: "100%",
                      justifyContent: "flex-end",
                      position: "relative",
                    }}
                  >
                    {current && v > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: "50%",
                          transform: "translateX(-50%)",
                          whiteSpace: "nowrap",
                          background: ACCENT,
                          color: "#0D0D0F",
                          ...mono(10, 600),
                          padding: "5px 9px",
                          borderRadius: 8,
                          boxShadow: "0 4px 12px rgba(127,224,138,0.25)",
                        }}
                      >
                        {data.labels[i]} · {v >= 10000 ? "$" + (v / 1000).toFixed(1) + "k" : money(Math.round(v), 0)}
                      </div>
                    )}
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 30,
                        borderRadius: 7,
                        height: Math.round((v / maxv) * 150) + 6,
                        background: current ? ACCENT : "rgba(244,243,239,0.13)",
                        transformOrigin: "bottom",
                        animation: "grow .4s ease both",
                      }}
                    />
                    <span style={mono(10, 400, { color: current ? ACCENT : TER })}>{data.labels[i]}</span>
                  </div>
                );
              });
            })()}
        </div>
      </div>

      {/* top spending / excluded */}
      <div style={{ marginTop: 22 }}>
        <div
          style={{
            display: "flex",
            background: "#161618",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: 4,
            marginBottom: 16,
          }}
        >
          {(["top", "excl"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 10,
                ...mono(11, 600, { letterSpacing: 0.5 }),
                border: "none",
                cursor: "pointer",
                transition: "all .2s",
                background: tab === t ? "#F4F3EF" : "transparent",
                color: tab === t ? "#0D0D0F" : "rgba(244,243,239,0.4)",
              }}
            >
              {t === "top" ? "Top spending" : "Excluded"}
            </button>
          ))}
        </div>

        {tab === "top" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data?.top.length === 0 && (
              <div style={{ textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
                No spending in this period
              </div>
            )}
            {data?.top.map((t, i) => {
              const max = data.top[0]?.amount ?? 1;
              return (
                <div key={t.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <span style={serif(15, 400, { color: TEXT })}>{t.name}</span>
                    <span style={mono(14, 500, { color: TEXT })}>{money(Math.round(t.amount), 0)}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 6,
                        width: `${Math.round((t.amount / max) * 100)}%`,
                        background: t.color,
                        transition: "width .3s",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div data-rows="1" style={{ ...card, borderRadius: 18, overflow: "hidden" }}>
            {data?.excluded.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
                Nothing excluded in this period
              </div>
            )}
            {data?.excluded.map((e, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 14px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <TxAvatar name={e.name} color={e.color} logoUrl={e.logoUrl} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={serif(15, 400, {
                      color: "rgba(244,243,239,0.5)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    })}
                  >
                    {e.name}
                  </div>
                  <div style={{ ...microLabel, letterSpacing: 1, color: "rgba(244,243,239,0.3)", marginTop: 2 }}>{e.reason}</div>
                </div>
                <div style={mono(14, 500, { color: "rgba(244,243,239,0.4)", flex: "none" })}>
                  {e.amount < 0 ? `+${money(-e.amount)}` : `${MINUS}${money(e.amount)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
