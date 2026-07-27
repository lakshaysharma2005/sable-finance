"use client";

import { CategoryIcon } from "@/components/CategoryIcon";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TxAvatar } from "@/components/TxAvatar";
import { MINUS, money } from "@/lib/format";
import type { DashboardData } from "@/lib/queries";
import { ACCENT, card, microLabel, mono, serif, TER, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";
import { usePlaidConnect } from "@/components/PlaidLinkButton";

const SYNC_THROTTLE_MS = 15 * 60 * 1000;
const SYNC_KEY = "sable:lastSync";

export default function DashboardPage() {
  const { data, loading, reload } = useData<DashboardData>("/api/dashboard");
  const { start: startLink } = usePlaidConnect(() => window.location.reload());

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
      {data && data.cats.length > 0 ? (
        <CategoryDonutCard cats={data.cats} monthLabel={now.toLocaleDateString("en-US", { month: "long" })} />
      ) : (
        <div style={{ ...card, marginTop: 16, padding: "22px 22px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={serif(18, 400, { color: TEXT })}>By category</div>
            <div style={microLabel}>{now.toLocaleDateString("en-US", { month: "long" })}</div>
          </div>
          <div style={{ padding: "34px 0", textAlign: "center", ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }) }}>
            {loading ? "Loading…" : "No spending yet this month"}
          </div>
        </div>
      )}

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

const HIDDEN_CATS_KEY = "sable:donutHiddenCats";

type CatRow = DashboardData["cats"][number];

function loadHiddenCats(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_CATS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function persistHiddenCats(hidden: Set<string>) {
  localStorage.setItem(HIDDEN_CATS_KEY, JSON.stringify([...hidden]));
}

function CategoryDonutCard({ cats, monthLabel }: { cats: CatRow[]; monthLabel: string }) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHidden(loadHiddenCats());
  }, []);

  const visibleCats = cats.filter((c) => !hidden.has(c.name));
  // If every category would be hidden (stale localStorage / data change), fall back to all.
  const chartCats = visibleCats.length > 0 ? visibleCats : cats;
  const allHiddenIgnored = visibleCats.length === 0 && cats.length > 0;
  const effectiveHidden = allHiddenIgnored ? new Set<string>() : hidden;

  const visibleTotal = chartCats.reduce((sum, c) => sum + c.amount, 0);
  const chartRows = chartCats.map((c) => ({
    ...c,
    pct: visibleTotal > 0 ? Math.round((c.amount / visibleTotal) * 100) : 0,
  }));

  const hiddenCount = cats.filter((c) => effectiveHidden.has(c.name)).length;

  function toggleCat(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        // Keep at least one category on the chart
        const remaining = cats.filter((c) => c.name !== name && !next.has(c.name));
        if (remaining.length === 0) return prev;
        next.add(name);
      }
      persistHiddenCats(next);
      return next;
    });
  }

  function showAll() {
    const empty = new Set<string>();
    persistHiddenCats(empty);
    setHidden(empty);
  }

  return (
    <div style={{ ...card, marginTop: 16, padding: "22px 22px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={serif(18, 400, { color: TEXT })}>By category</div>
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={showAll}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              ...mono(10, 500, { letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT }),
            }}
          >
            Show all · {hiddenCount} hidden
          </button>
        ) : (
          <div style={microLabel}>{monthLabel}</div>
        )}
      </div>
      {hiddenCount > 0 && (
        <div style={{ ...microLabel, marginTop: 6, color: "rgba(244,243,239,0.45)" }}>
          {money(visibleTotal, 2)} without hidden · tap a category to toggle
        </div>
      )}
      <Donut cats={chartRows} />
      <div data-rows="1">
        {cats.map((c) => {
          const isOn = !effectiveHidden.has(c.name);
          const pct = isOn && visibleTotal > 0 ? Math.round((c.amount / visibleTotal) * 100) : c.pct;
          return (
            <div
              key={c.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 0",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                opacity: isOn ? 1 : 0.38,
                transition: "opacity .15s ease",
              }}
            >
              <button
                type="button"
                onClick={() => toggleCat(c.name)}
                aria-pressed={isOn}
                aria-label={`${isOn ? "Hide" : "Show"} ${c.name} on chart`}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    flex: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isOn ? `${c.color}22` : "rgba(255,255,255,0.04)",
                    border: isOn ? `1px solid ${c.color}55` : "1px solid rgba(255,255,255,0.08)",
                    position: "relative",
                  }}
                >
                  <CategoryIcon emoji={c.emoji} color={isOn ? c.color : "rgba(244,243,239,0.35)"} size="sm" />
                  {!isOn && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        width: 14,
                        height: 1.5,
                        background: "rgba(244,243,239,0.55)",
                        transform: "rotate(-45deg)",
                        borderRadius: 1,
                      }}
                    />
                  )}
                </span>
                <span
                  style={{
                    flex: 1,
                    ...serif(15, 400, {
                      color: TEXT,
                      textDecoration: isOn ? "none" : "line-through",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }),
                  }}
                >
                  {c.name}
                </span>
                <span style={mono(11, 400, { color: TER, marginRight: 4 })}>{isOn ? `${pct}%` : "—"}</span>
                <span style={mono(14, 500, { color: TEXT })}>{money(c.amount, 2)}</span>
              </button>
              <Link
                href={`/categories/${encodeURIComponent(c.name)}`}
                aria-label={`Open ${c.name}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                  textDecoration: "none",
                  color: TER,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          );
        })}
      </div>
      {hiddenCount === 0 && (
        <div style={{ ...microLabel, textAlign: "center", padding: "4px 0 8px", color: "rgba(244,243,239,0.28)" }}>
          Tap a category to hide it from the chart
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

function Donut({ cats }: { cats: CatRow[] }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const cx = 110;
  const cy = 110;
  const innerR = 67;
  const outerR = 93;
  const total = cats.reduce((sum, c) => sum + c.amount, 0);
  let cursor = 0;
  const segments = cats.map((c, i) => {
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
  const activeIdx = cats.length === 0 ? 0 : Math.min(selectedIdx, cats.length - 1);
  const activeCat = cats[activeIdx] ?? cats[0];
  const chartKey = cats.map((c) => c.name).join("|");

  useEffect(() => {
    setSelectedIdx(0);
  }, [chartKey]);

  if (!activeCat) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 16px" }}>
      <div style={{ position: "relative", width: 220, height: 220, animation: "donutIn .5s ease both" }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          {segments.map((s) => (
            <path
              key={s.index}
              d={s.path}
              fill={s.color}
              fillRule="evenodd"
              opacity={activeIdx === s.index ? 1 : 0.82}
              pointerEvents="visiblePainted"
              style={{ cursor: "pointer", transition: "opacity .15s ease" }}
              onClick={() => setSelectedIdx(s.index)}
            />
          ))}
          {cats.length > 1 &&
            segments.map((s) => {
              const inner = donutPoint(cx, cy, innerR, s.start);
              const outer = donutPoint(cx, cy, outerR, s.start);
              return (
                <line
                  key={`divider-${s.index}`}
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
            pointerEvents: "none",
          }}
        >
          <div style={mono(32, 500, { color: activeCat.color, letterSpacing: -1 })}>{activeCat.pct}%</div>
          {activeCat.emoji && <div style={{ fontSize: 22, lineHeight: 1, marginTop: 4 }}>{activeCat.emoji}</div>}
          <div style={{ ...microLabel, color: "rgba(244,243,239,0.5)", marginTop: 3 }}>{activeCat.name}</div>
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
