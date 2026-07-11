"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { TxAvatar } from "@/components/TxAvatar";
import { ChevronRightIcon } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { MINUS, money } from "@/lib/format";
import type { CategoryData } from "@/lib/queries";
import { ACCENT, card, microLabel, mono, serif, TER, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const rawName = params.name;
  const name = decodeURIComponent(Array.isArray(rawName) ? rawName[0] : (rawName ?? ""));
  const { data, loading, error } = useData<CategoryData>(`/api/categories/${encodeURIComponent(name)}`);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

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
  const displayName = data.name ?? name;

  function openRename() {
    setDraft(displayName);
    setRenameError(null);
    setRenameOpen(true);
  }

  async function saveRename() {
    const next = draft.trim();
    if (!next || next === displayName) {
      setRenameOpen(false);
      return;
    }
    setSaving(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(displayName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to rename category");
      setRenameOpen(false);
      router.replace(`/categories/${encodeURIComponent(next)}`);
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : "Failed to rename category");
    } finally {
      setSaving(false);
    }
  }

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
          {data.emoji ? (
            <span style={{ fontSize: 24, lineHeight: 1 }}>{data.emoji}</span>
          ) : (
            <span style={{ width: 16, height: 16, borderRadius: 5, background: data.color ?? "#8A8594" }} />
          )}
        </div>
        <button
          onClick={openRename}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            ...serif(28, 400, { color: data.color ?? TEXT }),
          }}
        >
          {displayName}
        </button>
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

      {renameOpen && (
        <Sheet onClose={() => setRenameOpen(false)} background="#161618" zIndex={35} style={{ padding: "0 24px 28px" }}>
          <div
            style={{
              textAlign: "center",
              ...mono(11, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: data.color ?? ACCENT }),
              padding: "6px 0 18px",
            }}
          >
            Rename category
          </div>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Category name"
            autoFocus
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "14px 16px",
              color: TEXT,
              ...serif(16),
              outline: "none",
              marginBottom: renameError ? 10 : 16,
            }}
          />
          {renameError && (
            <div style={{ ...mono(12, 400, { color: "#D98A7F", marginBottom: 16, textAlign: "center" }) }}>
              {renameError}
            </div>
          )}
          <button
            onClick={saveRename}
            disabled={saving || !draft.trim()}
            style={{
              width: "100%",
              padding: 15,
              borderRadius: 14,
              border: "none",
              background: ACCENT,
              color: "#0D0D0F",
              opacity: saving || !draft.trim() ? 0.5 : 1,
              ...mono(12, 600, { letterSpacing: 1, textTransform: "uppercase" }),
              cursor: saving || !draft.trim() ? "default" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setRenameOpen(false)}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              padding: "14px 0 0",
              ...serif(15, 400, { color: "rgba(244,243,239,0.45)" }),
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </Sheet>
      )}
    </div>
  );
}
