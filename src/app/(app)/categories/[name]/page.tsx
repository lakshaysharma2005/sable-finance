"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TxAvatar } from "@/components/TxAvatar";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ChevronRightIcon, DotsIcon } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { TransactionDetailSheets } from "@/components/TransactionDetailSheets";
import { MINUS, money } from "@/lib/format";
import type { CategoryData, TxItem } from "@/lib/queries";
import { ACCENT, card, microLabel, mono, serif, TER, TEXT } from "@/lib/ui";
import { CATEGORY_PALETTE } from "@/lib/categories";
import { useData } from "@/lib/useData";

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const rawName = params.name;
  const name = decodeURIComponent(Array.isArray(rawName) ? rawName[0] : (rawName ?? ""));
  const { data, loading, error, reload } = useData<CategoryData>(`/api/categories/${encodeURIComponent(name)}`);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TxItem | null>(null);
  const [draft, setDraft] = useState(name);

  async function openTransaction(it: TxItem) {
    if (it.isSplitPortion && it.parentTxId) {
      const res = await fetch(`/api/transactions/${it.parentTxId}`);
      if (res.ok) {
        setSelectedTx(await res.json());
        return;
      }
    }
    setSelectedTx(it);
  }
  const [draftEmoji, setDraftEmoji] = useState("📁");
  const [draftColor, setDraftColor] = useState("#8A8594");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

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
  const displayEmoji = data.emoji ?? "📁";
  const displayColor = data.color ?? "#8A8594";

  function openEdit() {
    setDraft(displayName);
    setDraftEmoji(displayEmoji);
    setDraftColor(displayColor);
    setEditError(null);
    setEditOpen(true);
  }

  async function saveEdit() {
    const nextName = draft.trim();
    const nextEmoji = draftEmoji.trim() || displayEmoji;
    const nextColor = draftColor.trim() || displayColor;
    if (!nextName) return;

    const unchanged =
      nextName === displayName && nextEmoji === displayEmoji && nextColor === displayColor;
    if (unchanged) {
      setEditOpen(false);
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(displayName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName, emoji: nextEmoji, color: nextColor }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to update category");
      setEditOpen(false);
      if (nextName !== displayName) {
        router.replace(`/categories/${encodeURIComponent(nextName)}`);
      } else {
        reload();
      }
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to update category");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(displayName)}`, {
        method: "DELETE",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to delete category");
      setDeleteOpen(false);
      router.replace("/");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete category");
    } finally {
      setDeleting(false);
    }
  }

  const editUnchanged =
    draft.trim() === displayName &&
    (draftEmoji.trim() || displayEmoji) === displayEmoji &&
    draftColor === displayColor;

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
        <div ref={menuRef} style={{ position: "relative", width: 40, height: 40 }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Category options"
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
            <DotsIcon />
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: 46,
                right: 0,
                background: "#202022",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 14,
                padding: 6,
                minWidth: 170,
                boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
                zIndex: 5,
              }}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  padding: "11px 12px",
                  borderRadius: 9,
                  ...serif(14, 400, { color: "#D98A7F" }),
                  cursor: "pointer",
                }}
              >
                Delete category
              </button>
            </div>
          )}
        </div>
      </div>

      {/* category title */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <button
          onClick={openEdit}
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: (data.color ?? "#8A8594") + "22",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
            cursor: "pointer",
          }}
        >
          <CategoryIcon emoji={data.emoji} color={data.color ?? "#8A8594"} size="lg" />
        </button>
        <button
          onClick={openEdit}
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

        {groups.map((g) => {
          const monthTotal = (g.items ?? []).reduce((s, it) => s + it.amount, 0);
          return (
          <div key={g.monthKey} style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
                padding: "0 2px",
              }}
            >
              <div style={serif(16, 400, { color: TEXT })}>{g.label}</div>
              <div style={mono(13, 500, { color: TER })}>{money(monthTotal)}</div>
            </div>
            <div data-rows="1" style={{ ...card, borderRadius: 18, overflow: "hidden" }}>
              {(g.items ?? []).map((it) => {
                const [, m, d] = it.date.split("-").map(Number);
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const dateLabel = `${months[m - 1]} ${d}`;
                return (
                  <div
                    key={it.splitRowId ? `split-${it.splitRowId}` : it.id}
                    onClick={() => openTransaction(it)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 14px",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ ...mono(11, 500, { color: (data.color ?? TER) + "cc" }), flex: "none", width: 42 }}>
                      {dateLabel}
                    </span>
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
                    </div>
                    <div style={mono(14, 500, { color: it.amount < 0 ? "#7FE08A" : TEXT, flex: "none" })}>
                      {it.amount < 0 ? `+${money(-it.amount)}` : `${MINUS}${money(it.amount)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          );
        })}
      </div>

      <TransactionDetailSheets
        tx={selectedTx}
        onClose={() => setSelectedTx(null)}
        onTxUpdate={setSelectedTx}
        onCategoryChanged={reload}
      />

      {editOpen && (
        <Sheet onClose={() => setEditOpen(false)} background="#161618" zIndex={35} style={{ padding: "0 24px 28px" }}>
          <div
            style={{
              textAlign: "center",
              ...mono(11, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: data.color ?? ACCENT }),
              padding: "6px 0 18px",
            }}
          >
            Edit category
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: editError ? 10 : 16 }}>
            <input
              value={draftEmoji}
              onChange={(e) => setDraftEmoji(e.target.value.slice(0, 4))}
              style={{
                width: 52,
                flex: "none",
                textAlign: "center",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "14px 8px",
                fontSize: 22,
                outline: "none",
              }}
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Category name"
              autoFocus
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "14px 16px",
                color: TEXT,
                ...serif(16),
                outline: "none",
              }}
            />
          </div>
          <div style={{ marginBottom: editError ? 10 : 16 }}>
            <div style={{ ...microLabel, color: TER, marginBottom: 10 }}>Color</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {CATEGORY_PALETTE.map((color) => {
                const selected = draftColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setDraftColor(color)}
                    aria-label={`Color ${color}`}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: color,
                      border: selected ? "2px solid #F4F3EF" : "2px solid transparent",
                      boxShadow: selected ? `0 0 0 2px ${color}` : "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                );
              })}
            </div>
          </div>
          {editError && (
            <div style={{ ...mono(12, 400, { color: "#D98A7F", marginBottom: 16, textAlign: "center" }) }}>
              {editError}
            </div>
          )}
          <button
            onClick={saveEdit}
            disabled={saving || !draft.trim() || editUnchanged}
            style={{
              width: "100%",
              padding: 15,
              borderRadius: 14,
              border: "none",
              background: ACCENT,
              color: "#0D0D0F",
              opacity: saving || !draft.trim() || editUnchanged ? 0.5 : 1,
              ...mono(12, 600, { letterSpacing: 1, textTransform: "uppercase" }),
              cursor: saving || !draft.trim() || editUnchanged ? "default" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setEditOpen(false)}
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

      {deleteOpen && (
        <Sheet onClose={() => setDeleteOpen(false)} background="#161618" zIndex={35} style={{ padding: "0 24px 28px" }}>
          <div
            style={{
              textAlign: "center",
              ...mono(11, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: "#D98A7F" }),
              padding: "6px 0 14px",
            }}
          >
            Delete category
          </div>
          <div
            style={{
              textAlign: "center",
              ...serif(16, 400, { color: "rgba(244,243,239,0.7)", lineHeight: 1.45, marginBottom: deleteError ? 12 : 20 }),
            }}
          >
            Delete {displayName}? Transactions in this category will move to Other.
          </div>
          {deleteError && (
            <div style={{ ...mono(12, 400, { color: "#D98A7F", marginBottom: 16, textAlign: "center" }) }}>
              {deleteError}
            </div>
          )}
          <button
            onClick={confirmDelete}
            disabled={deleting}
            style={{
              width: "100%",
              padding: 15,
              borderRadius: 14,
              border: "none",
              background: "#D98A7F",
              color: "#0D0D0F",
              opacity: deleting ? 0.5 : 1,
              ...mono(12, 600, { letterSpacing: 1, textTransform: "uppercase" }),
              cursor: deleting ? "default" : "pointer",
            }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={() => setDeleteOpen(false)}
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
