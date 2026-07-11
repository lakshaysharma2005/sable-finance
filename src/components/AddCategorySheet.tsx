"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import type { CategoriesListData } from "@/lib/category-queries";
import { ACCENT, mono, serif, TEXT } from "@/lib/ui";

const SHEET_ACCENT = "#6B8AB0";

type View = "list" | "create";

export function AddCategorySheet({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const [view, setView] = useState<View>("list");
  const [data, setData] = useState<CategoriesListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("📁");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to load");
      setData((await res.json()) as CategoriesListData);
      setError(null);
    } catch {
      setError("Could not load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createCategory(input: { name: string; emoji?: string; color?: string }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to create category");
      onCreated?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  async function saveCustom() {
    if (!draftName.trim()) return;
    await createCategory({ name: draftName, emoji: draftEmoji });
  }

  return (
    <Sheet onClose={onClose} background="#0D0D0F" zIndex={45}>
      {view === "list" ? (
        <>
          <div
            style={{
              textAlign: "center",
              ...mono(11, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: SHEET_ACCENT }),
              padding: "6px 0 4px",
            }}
          >
            Add a category
          </div>
          <button
            onClick={() => setView("create")}
            style={{
              display: "block",
              width: "100%",
              background: "none",
              border: "none",
              padding: "14px 24px 18px",
              ...serif(18, 400, { color: SHEET_ACCENT }),
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            Start a new one from scratch
          </button>

          {loading && (
            <div style={{ textAlign: "center", padding: "24px 0", ...mono(12, 400, { color: "rgba(244,243,239,0.35)" }) }}>
              Loading…
            </div>
          )}

          {error && !loading && (
            <div style={{ textAlign: "center", padding: "8px 24px 16px", ...mono(12, 400, { color: "#D98A7F" }) }}>
              {error}
            </div>
          )}

          {data?.suggested.map((s) => (
            <button
              key={s.name}
              disabled={saving}
              onClick={() => createCategory(s)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                width: "100%",
                padding: "13px 24px",
                border: "none",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                background: "transparent",
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{s.emoji}</span>
              <span style={serif(17, 400, { color: TEXT })}>{s.name}</span>
            </button>
          ))}

          {data && data.suggested.length === 0 && !loading && (
            <div
              style={{
                textAlign: "center",
                padding: "20px 24px 28px",
                ...mono(11, 400, { color: "rgba(244,243,239,0.35)", lineHeight: 1.5 }),
              }}
            >
              All suggested categories have been added.
            </div>
          )}

          <div style={{ paddingBottom: 24 }} />
        </>
      ) : (
        <div style={{ padding: "0 24px 28px" }}>
          <div
            style={{
              textAlign: "center",
              ...mono(11, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: SHEET_ACCENT }),
              padding: "6px 0 18px",
            }}
          >
            New category
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
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
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
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
          {error && (
            <div style={{ ...mono(12, 400, { color: "#D98A7F", marginBottom: 12, textAlign: "center" }) }}>{error}</div>
          )}
          <button
            onClick={saveCustom}
            disabled={saving || !draftName.trim()}
            style={{
              width: "100%",
              padding: 15,
              borderRadius: 14,
              border: "none",
              background: ACCENT,
              color: "#0D0D0F",
              opacity: saving || !draftName.trim() ? 0.5 : 1,
              ...mono(12, 600, { letterSpacing: 1, textTransform: "uppercase" }),
              cursor: saving || !draftName.trim() ? "default" : "pointer",
            }}
          >
            {saving ? "Creating…" : "Create category"}
          </button>
          <button
            onClick={() => {
              setView("list");
              setError(null);
            }}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              padding: "14px 0 0",
              ...serif(15, 400, { color: "rgba(244,243,239,0.45)" }),
              cursor: "pointer",
            }}
          >
            Back
          </button>
        </div>
      )}
    </Sheet>
  );
}
