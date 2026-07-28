"use client";

import { CategoryIcon } from "@/components/CategoryIcon";
import { AmountDisplay } from "@/components/AmountDisplay";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TxAvatar } from "@/components/TxAvatar";
import { MINUS, money } from "@/lib/format";
import type { DashboardData } from "@/lib/queries";
import { sortSpendingCategories } from "@/lib/queries";
import { ACCENT, card, microLabel, mono, serif, TER, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";
import { usePlaidConnectContext } from "@/components/PlaidConnectProvider";

const SYNC_THROTTLE_MS = 15 * 60 * 1000;
const SYNC_KEY = "sable:lastSync";

export default function DashboardPage() {
  const { data, loading, reload } = useData<DashboardData>("/api/dashboard");
  const { start: startLink } = usePlaidConnectContext();

  useEffect(() => {
    let cancelled = false;
    async function syncIfStale() {
      const last = Number(sessionStorage.getItem(SYNC_KEY) || 0);
      if (Date.now() - last < SYNC_THROTTLE_MS) return;
      try {
        const res = await fetch("/api/sync", { method: "POST" });
        if (!res.ok || cancelled) return;
        sessionStorage.setItem(SYNC_KEY, String(Date.now()));
        await reload();
      } catch {
        // Best-effort background refresh
      }
    }
    void syncIfStale();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const sortedCats = useMemo(
    () => (data?.cats ? sortSpendingCategories(data.cats) : []),
    [data?.cats],
  );

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
        <AmountDisplay
          amount={data?.spent}
          prefix="$"
          size={46}
          centsSize={22}
          letterSpacing={-2}
          style={{ marginTop: 12 }}
        />
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
        {sortedCats.length > 0 ? (
          <Donut cats={sortedCats} />
        ) : (
          <div style={{ padding: "34px 0", textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
            {loading ? "Loading…" : "No spending yet this month"}
          </div>
        )}
        <div data-rows="1">
          {sortedCats.map((c) => (
            <Link
              key={c.name}
              href={`/categories/${encodeURIComponent(c.name)}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 0",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              <CategoryIcon emoji={c.emoji} color={c.color} size="sm" />
              <span style={{ flex: 1, ...serif(15, 400, { color: TEXT }) }}>{c.name}</span>
              <span style={mono(11, 400, { color: TER, marginRight: 12 })}>{c.pct}%</span>
              <span style={mono(14, 500, { color: TEXT })}>{money(c.amount, 2)}</span>
            </Link>
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
            onClick={() => startLink()}
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

function donutPoint(cx: number, cy: number, radius: number, degrees: number) {
  const rad = ((degrees - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function donutSegmentPath(cx: number, cy: number, innerR: number, outerR: number, startDeg: number, endDeg: number) {
  const sweep = endDeg - startDeg;
  if (sweep <= 0) return "";
  if (sweep >= 359.999) {
    const east = { x: cx + outerR, y: cy };
    const west = { x: cx - outerR, y: cy };
    const eastInner = { x: cx + innerR, y: cy };
    const westInner = { x: cx - innerR, y: cy };
    return [
      `M ${east.x} ${east.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${west.x} ${west.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${east.x} ${east.y}`,
      `M ${eastInner.x} ${eastInner.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${westInner.x} ${westInner.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${eastInner.x} ${eastInner.y}`,
      "Z",
    ].join(" ");
  }

  const largeArc = sweep > 180 ? 1 : 0;
  const outerStart = donutPoint(cx, cy, outerR, startDeg);
  const outerEnd = donutPoint(cx, cy, outerR, endDeg);
  const innerEnd = donutPoint(cx, cy, innerR, endDeg);
  const innerStart = donutPoint(cx, cy, innerR, startDeg);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function Donut({ cats }: { cats: DashboardData["cats"] }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const sortedCats = useMemo(() => sortSpendingCategories(cats), [cats]);
  const cx = 110;
  const cy = 110;
  const innerR = 67;
  const outerR = 93;
  const total = sortedCats.reduce((sum, c) => sum + c.amount, 0);
  let cursor = 0;
  const segments = sortedCats.map((c, i) => {
    const sweep = total > 0 ? (c.amount / total) * 360 : 0;
    const start = cursor;
    cursor += sweep;
    return {
      path: donutSegmentPath(cx, cy, innerR, outerR, start, cursor),
      start,
      color: c.color,
      cat: c,
      index: i,
    };
  });
  const activeIdx = Math.min(selectedIdx, sortedCats.length - 1);
  const activeCat = sortedCats[activeIdx] ?? sortedCats[0];

  useEffect(() => {
    setSelectedIdx(0);
  }, [sortedCats]);

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 16px" }}>
      <div style={{ position: "relative", width: 220, height: 220, animation: "donutIn .5s ease both" }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          {segments.map((s) => (
            <path
              key={s.cat.name}
              d={s.path}
              fill={s.color}
              fillRule="evenodd"
              opacity={activeIdx === s.index ? 1 : 0.82}
              pointerEvents="visiblePainted"
              style={{ cursor: "pointer", transition: "opacity .15s ease" }}
              onClick={() => setSelectedIdx(s.index)}
            />
          ))}
          {sortedCats.length > 1 &&
            segments.map((s) => {
              const inner = donutPoint(cx, cy, innerR, s.start);
              const outer = donutPoint(cx, cy, outerR, s.start);
              return (
                <line
                  key={`divider-${s.cat.name}`}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="#0D0D0F"
                  strokeWidth={2}
                  pointerEvents="none"
                />
              );
            })}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            pointerEvents: "none",
            padding: "0 12px",
          }}
        >
          <div style={mono(33, 500, { color: activeCat.color, letterSpacing: -0.75, lineHeight: 1 })}>
            {activeCat.pct}%
          </div>
          <div
            style={mono(10, 500, {
              letterSpacing: 1.8,
              textTransform: "uppercase",
              color: "rgba(244,243,239,0.38)",
              lineHeight: 1.2,
              maxWidth: 118,
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            })}
          >
            {activeCat.name}
          </div>
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
                  <div style={{ ...microLabel, letterSpacing: 1, color: "rgba(244,243,239,0.5)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
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
                  padding: "12px 16px",
                  minHeight: 44,
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
