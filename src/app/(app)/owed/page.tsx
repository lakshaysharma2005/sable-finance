"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AmountDisplay } from "@/components/AmountDisplay";
import { ChevronRightIcon } from "@/components/Icons";
import { LinkPaymentSheet } from "@/components/LinkPaymentSheet";
import { TxAvatar } from "@/components/TxAvatar";
import { money } from "@/lib/format";
import type { OwedPerson, OwedSplitLine, OwedSummary } from "@/lib/owed";
import { ACCENT, card, microLabel, mono, serif, TER, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";

type OwedData = OwedSummary & { labels: string[] };

export default function OwedPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useData<OwedData>("/api/owed");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<{
    splitId: number;
    remaining: number;
    personLabel: string;
  } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function markSettled(splitId: number, settled: boolean) {
    const key = `settle-${splitId}`;
    if (busyKey) return;
    setBusyKey(key);
    try {
      await fetch(`/api/owed/splits/${splitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settled }),
      });
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

  async function unlink(repaymentId: number) {
    const key = `unlink-${repaymentId}`;
    if (busyKey) return;
    setBusyKey(key);
    try {
      await fetch(`/api/owed/repayments/${repaymentId}`, { method: "DELETE" });
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

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
          {error ? "Could not load owed ledger" : "Nothing here"}
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

  const people = data.people ?? [];

  return (
    <div style={{ animation: "fadeUp .3s ease both", paddingBottom: 24 }}>
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
        <div style={mono(10, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: "#6B8AB0" })}>
          Owed
        </div>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ ...microLabel, color: "#6B8AB0aa", marginBottom: 8 }}>Still owed</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center" }}>
          <span style={mono(22, 500, { color: TER })}>$</span>
          <AmountDisplay amount={data.totalOpen} size={46} centsSize={22} letterSpacing={-2} />
        </div>
        <div style={mono(13, 400, { color: TER, marginTop: 6 })}>across named splits</div>
      </div>

      {people.length === 0 && (
        <div
          style={{
            ...card,
            borderRadius: 18,
            padding: 24,
            textAlign: "center",
            ...serif(14, 400, { color: "rgba(244,243,239,0.4)" }),
          }}
        >
          Name people when you split a transaction to track what they owe you.
        </div>
      )}

      {people.map((person) => (
        <PersonCard
          key={person.label}
          person={person}
          expanded={expanded === person.label}
          onToggle={() => setExpanded((v) => (v === person.label ? null : person.label))}
          busyKey={busyKey}
          onMarkSettled={markSettled}
          onUnlink={unlink}
          onLink={(line) =>
            setLinkTarget({
              splitId: line.splitId,
              remaining: line.remaining > 0 ? line.remaining : line.amount,
              personLabel: person.label,
            })
          }
        />
      ))}

      {linkTarget && (
        <LinkPaymentSheet
          splitId={linkTarget.splitId}
          remaining={linkTarget.remaining}
          personLabel={linkTarget.personLabel}
          onClose={() => setLinkTarget(null)}
          onLinked={() => reload()}
        />
      )}
    </div>
  );
}

function PersonCard({
  person,
  expanded,
  onToggle,
  busyKey,
  onMarkSettled,
  onUnlink,
  onLink,
}: {
  person: OwedPerson;
  expanded: boolean;
  onToggle: () => void;
  busyKey: string | null;
  onMarkSettled: (splitId: number, settled: boolean) => void;
  onUnlink: (repaymentId: number) => void;
  onLink: (line: OwedSplitLine) => void;
}) {
  return (
    <div style={{ ...card, borderRadius: 18, marginBottom: 14, overflow: "hidden" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <TxAvatar name={person.label} color="#6B8AB0" logoUrl={null} accountName={null} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={serif(17, 400, { color: TEXT })}>{person.label}</div>
          <div style={mono(11, 400, { color: TER, marginTop: 3 })}>
            {person.open > 0 ? `${money(person.open)} open` : "All settled"}
            {person.repaid > 0 ? ` · ${money(person.repaid)} repaid` : ""}
          </div>
        </div>
        <div style={mono(15, 500, { color: person.open > 0 ? TEXT : ACCENT, flex: "none" })}>
          {person.open > 0 ? money(person.open) : "✓"}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {person.lines.map((line) => (
            <div
              key={line.splitId}
              style={{
                padding: "14px 16px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                opacity: line.settledAt && line.remaining <= 0 ? 0.55 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={serif(14, 400, {
                      color: TEXT,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    })}
                  >
                    {line.parentName}
                  </div>
                  <div style={mono(11, 400, { color: TER, marginTop: 3 })}>
                    {line.parentDate} · {money(line.amount)}
                    {line.settledAt ? " · Settled" : line.remaining < line.amount ? ` · ${money(line.remaining)} left` : " · Open"}
                  </div>
                </div>
                <div style={mono(13, 500, { color: TEXT, flex: "none" })}>{money(line.amount)}</div>
              </div>

              {line.repayments.length > 0 && (
                <div style={{ margin: "8px 0 4px", paddingLeft: 4 }}>
                  {line.repayments.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 0",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, ...mono(11, 400, { color: ACCENT }) }}>
                        +{money(r.amount)} · {r.name}
                      </div>
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => onUnlink(r.id)}
                        style={{
                          background: "none",
                          border: "none",
                          ...mono(10, 600, { color: "rgba(244,243,239,0.35)", letterSpacing: 0.5 }),
                          cursor: "pointer",
                          padding: "4px 6px",
                        }}
                      >
                        Unlink
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {!line.settledAt && line.remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => onLink(line)}
                    style={{
                      background: "rgba(107,138,176,0.2)",
                      border: "none",
                      borderRadius: 999,
                      padding: "8px 14px",
                      ...mono(10, 700, { letterSpacing: 1, color: "#6B8AB0", textTransform: "uppercase" }),
                      cursor: "pointer",
                    }}
                  >
                    Link payment
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => onMarkSettled(line.splitId, !line.settledAt)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "none",
                    borderRadius: 999,
                    padding: "8px 14px",
                    ...mono(10, 700, {
                      letterSpacing: 1,
                      color: "rgba(244,243,239,0.55)",
                      textTransform: "uppercase",
                    }),
                    cursor: busyKey ? "wait" : "pointer",
                  }}
                >
                  {line.settledAt ? "Mark open" : "Mark paid"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
