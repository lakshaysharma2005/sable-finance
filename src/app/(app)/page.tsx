"use client";

import { useState } from "react";
import { TxAvatar } from "@/components/TxAvatar";
import { MINUS, money } from "@/lib/format";
import type { DashboardData } from "@/lib/queries";
import { ACCENT, card, microLabel, mono, serif, TER, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";
import { usePlaidConnect } from "@/components/PlaidLinkButton";

export default function DashboardPage() {
  const { data, loading, reload } = useData<DashboardData>("/api/dashboard");
  const { start: startLink } = usePlaidConnect(() => window.location.reload());

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ animation: "fadeUp .3s ease both" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={mono(11, 400, { letterSpacing: 2, textTransform: "uppercase", color: TER })}>{dateLabel}</div>
          <div style={serif(22, 400, { color: TEXT, marginTop: 5 })}>{greeting}, Lakshay</div>
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            background: "#262229",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...mono(14, 600, { color: "#C49A6B" }),
          }}
        >
          L
        </div>
      </div>

      {/* hero card */}
      <div style={{ ...card, padding: 22 }}>
        <div style={{ ...microLabel, letterSpacing: 2, fontSize: 11, color: "rgba(244,243,239,0.5)" }}>Spent this month</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 1, marginTop: 12 }}>
          <span style={mono(46, 500, { color: TEXT, letterSpacing: -2 })}>
            {data ? "$" + Math.floor(data.spent).toLocaleString("en-US") : "$—"}
          </span>
          <span style={mono(22, 500, { color: TER })}>.{data ? data.spent.toFixed(2).split(".")[1] : "—"}</span>
        </div>
        {data && data.prevSpent > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: data.deltaPct >= 0 ? "rgba(127,224,138,0.14)" : "rgba(217,138,127,0.14)",
                color: data.deltaPct >= 0 ? ACCENT : "#D98A7F",
                ...mono(11, 600),
                padding: "5px 9px",
                borderRadius: 8,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 12 12" style={{ transform: data.deltaPct >= 0 ? "none" : "rotate(180deg)" }}>
                <path d="M6 10L1 3h10z" fill={data.deltaPct >= 0 ? ACCENT : "#D98A7F"} />
              </svg>
              {Math.abs(data.deltaPct).toFixed(1)}%
            </span>
            <span style={mono(12, 400, { color: "rgba(244,243,239,0.5)" })}>
              {data.deltaPct >= 0 ? "less" : "more"} than {data.prevMonthName}
            </span>
          </div>
        )}
      </div>

      {/* donut card */}
      <div style={{ ...card, marginTop: 16, padding: "22px 22px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={serif(18, 400, { color: TEXT })}>By category</div>
          <div style={microLabel}>{now.toLocaleDateString("en-US", { month: "long" })}</div>
        </div>
        {data && data.cats.length > 0 ? (
          <Donut cats={data.cats} />
        ) : (
          <div style={{ padding: "34px 0", textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
            {loading ? "Loading…" : "No spending yet this month"}
          </div>
        )}
        <div data-rows="1">
          {data?.cats.map((c) => (
            <div
              key={c.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 0",
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 3, flex: "none", background: c.color }} />
              <span style={{ flex: 1, ...serif(15, 400, { color: TEXT }) }}>{c.name}</span>
              <span style={mono(11, 400, { color: TER, marginRight: 12 })}>{c.pct}%</span>
              <span style={mono(14, 500, { color: TEXT })}>{money(c.amount, 2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* to review */}
      {data && <ToReview data={data} reload={reload} />}

      {/* connect CTA when nothing linked */}
      {data && data.cats.length === 0 && data.groups.length === 0 && !loading && (
        <div style={{ ...card, marginTop: 16, padding: 22, textAlign: "center" }}>
          <div style={serif(16, 400, { color: TEXT, marginBottom: 6 })}>No accounts connected</div>
          <div style={serif(13, 400, { color: "rgba(244,243,239,0.4)", marginBottom: 16 })}>
            Link your bank to start tracking spending automatically.
          </div>
          <button
            onClick={startLink}
            style={{
              padding: "13px 24px",
              borderRadius: 14,
              border: "none",
              background: ACCENT,
              color: "#0D0D0F",
              ...mono(12, 600, { letterSpacing: 1, textTransform: "uppercase" }),
              cursor: "pointer",
            }}
          >
            Connect with Plaid
          </button>
        </div>
      )}
    </div>
  );
}

function Donut({ cats }: { cats: DashboardData["cats"] }) {
  const r = 80;
  const C = 2 * Math.PI * r;
  const gap = 6;
  let acc = 0;
  const segments = cats.map((c) => {
    const len = (C * c.pct) / 100;
    const vis = Math.max(len - gap, 0.001);
    const seg = { dash: `${vis.toFixed(2)} ${(C - vis).toFixed(2)}`, offset: (-acc).toFixed(2), color: c.color };
    acc += len;
    return seg;
  });
  const topCat = cats[0];

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 16px" }}>
      <div style={{ position: "relative", width: 220, height: 220, animation: "donutIn .5s ease both" }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          <g transform="rotate(-90 110 110)">
            <circle cx="110" cy="110" r={r} fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="26" />
            {segments.map((s, i) => (
              <circle
                key={i}
                cx="110"
                cy="110"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="26"
                strokeLinecap="butt"
                strokeDasharray={s.dash}
                strokeDashoffset={s.offset}
              />
            ))}
          </g>
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={mono(32, 500, { color: topCat.color, letterSpacing: -1 })}>{topCat.pct}%</div>
          <div style={{ ...microLabel, color: "rgba(244,243,239,0.5)", marginTop: 3 }}>{topCat.name}</div>
        </div>
      </div>
    </div>
  );
}

function ToReview({ data, reload }: { data: DashboardData; reload: () => void }) {
  const [marking, setMarking] = useState(false);
  const pending = data.reviewGroups;
  const front = pending[0];

  async function markReviewed() {
    if (!front || marking) return;
    setMarking(true);
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: front.date }),
    });
    await reload();
    setMarking(false);
  }

  return (
    <div style={{ marginTop: 16, paddingBottom: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          padding: "0 2px",
        }}
      >
        <div style={serif(18, 400, { color: TEXT })}>To Review</div>
        <span style={microLabel}>{pending.length} pending</span>
      </div>

      {front ? (
        <div style={{ position: "relative", paddingBottom: 22 }}>
          {pending.length >= 3 && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 10,
                right: 10,
                height: 52,
                borderRadius: 16,
                background: "#202022",
                zIndex: 1,
              }}
            />
          )}
          {pending.length >= 2 && (
            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: 5,
                right: 5,
                height: 52,
                borderRadius: 16,
                background: "#1c1c1f",
                border: "1px solid rgba(255,255,255,0.05)",
                zIndex: 2,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "16px 14px", ...microLabel, color: "rgba(244,243,239,0.2)" }}>{pending[1].label}</div>
            </div>
          )}
          <div
            style={{
              position: "relative",
              zIndex: 3,
              background: "#161618",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={microLabel}>{front.label}</span>
            </div>
            {front.items.map((it) => (
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
                  <div style={{ ...microLabel, letterSpacing: 1, color: "rgba(244,243,239,0.5)", marginTop: 2 }}>{it.category}</div>
                </div>
                <div style={mono(15, 500, { color: it.amount < 0 ? ACCENT : TEXT, flex: "none" })}>
                  {it.amount < 0 ? `+${money(-it.amount)}` : `${MINUS}${money(it.amount)}`}
                </div>
              </div>
            ))}
            <div
              style={{
                padding: "12px 14px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <button
                onClick={markReviewed}
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent",
                  color: "rgba(244,243,239,0.5)",
                  ...mono(10, 600, { letterSpacing: 1 }),
                  padding: "7px 13px",
                  borderRadius: 9,
                  cursor: "pointer",
                }}
              >
                {marking ? "…" : "MARK AS REVIEWED"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ ...card, borderRadius: 18, padding: 22, textAlign: "center" }}>
          <div style={mono(12, 600, { letterSpacing: 1, color: ACCENT, marginBottom: 6 })}>✓ All caught up</div>
          <div style={serif(14, 400, { color: "rgba(244,243,239,0.4)" })}>No transactions to review</div>
        </div>
      )}
    </div>
  );
}
