"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CloseIcon } from "@/components/Icons";
import type { CategoriesListData } from "@/lib/category-queries";
import { EXCLUDED_CATEGORIES } from "@/lib/categories";
import { tint } from "@/lib/format";
import type { AccountsData } from "@/lib/queries";
import { ACCENT, chipBase, chipOff, chipOn, microLabel, mono, serif, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"] as const;

function formatAmtDisplay(amt: string): string {
  const parts = amt.split(".");
  const whole = parts[0] ? Number(parts[0]).toLocaleString("en-US") : "0";
  return amt.includes(".") ? `${whole}.${parts[1] ?? ""}` : whole;
}

function applyKey(current: string, key: string): string {
  if (key === "⌫") return current.slice(0, -1);
  if (key === ".") {
    if (current.includes(".")) return current;
    return (current || "0") + ".";
  }
  if (current.includes(".") && (current.split(".")[1]?.length ?? 0) >= 2) return current;
  if (current.replace(".", "").length >= 7) return current;
  return current === "0" ? key : current + key;
}

export default function AddExpensePage() {
  const router = useRouter();
  const { data: accountsData } = useData<AccountsData>("/api/accounts");
  const { data: categoriesData } = useData<CategoriesListData>("/api/categories");

  const categories = useMemo(
    () =>
      (categoriesData?.categories ?? []).filter(
        (c) => !(EXCLUDED_CATEGORIES as readonly string[]).includes(c.name),
      ),
    [categoriesData],
  );
  const accounts = accountsData?.accounts ?? [];

  const [amt, setAmt] = useState("");
  const [category, setCategory] = useState("Food & Drink");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accountId === null && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.name === category)) {
      setCategory(categories[0].name);
    }
  }, [categories, category]);

  const canSave = parseFloat(amt) > 0 && accountId !== null && !saving;
  const display = formatAmtDisplay(amt);

  async function save() {
    if (!canSave || accountId === null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amt),
          category,
          accountId,
        }),
      });
      const body = (await res.json()) as { error?: string; accountName?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to add expense");
      setSavedLabel(`Added to ${body.accountName ?? "account"}`);
      setAmt("");
      setTimeout(() => {
        setSavedLabel(null);
        router.replace("/");
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        margin: "0 -18px -92px",
        padding: "0 18px 14px",
        minHeight: "calc(100dvh - max(18px, env(safe-area-inset-top)) - 18px)",
        display: "flex",
        flexDirection: "column",
        animation: "fadeUp .3s ease both",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={serif(22, 400, { color: TEXT })}>New expense</div>
        <button
          onClick={() => router.back()}
          aria-label="Close"
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
          <CloseIcon />
        </button>
      </div>

      <div style={{ textAlign: "center", padding: "18px 0 14px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 3 }}>
          <span style={mono(24, 500, { color: "rgba(244,243,239,0.4)" })}>−$</span>
          <span style={mono(54, 500, { color: TEXT, letterSpacing: -2 })}>{display}</span>
        </div>
      </div>

      <div style={{ ...microLabel, marginBottom: 9 }}>Category</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {categories.map((c) => {
          const selected = category === c.name;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => setCategory(c.name)}
              style={{
                ...chipBase,
                ...(selected
                  ? {
                      background: tint(c.color),
                      color: c.color,
                      border: `1px solid ${c.color}66`,
                    }
                  : chipOff),
              }}
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
          );
        })}
      </div>

      <div style={{ ...microLabel, marginBottom: 9 }}>Pay from</div>
      {accounts.length === 0 ? (
        <div style={mono(12, 400, { color: "rgba(244,243,239,0.4)", marginBottom: 8 })}>
          Connect a bank account first to log an expense.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 8 }}>
          {accounts.map((a) => {
            const selected = accountId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccountId(a.id)}
                style={{
                  ...chipBase,
                  ...(selected ? chipOn : chipOff),
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 3,
                    flex: "none",
                    background: a.color,
                  }}
                />
                {a.name} ••{a.mask ?? "????"}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ ...mono(12, 400, { color: "#D98A7F", textAlign: "center", marginTop: 8 }) }}>{error}</div>
      )}

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6,
          marginBottom: 14,
        }}
      >
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAmt((v) => applyKey(v, k))}
            style={{
              height: 58,
              borderRadius: 16,
              border: "none",
              background: "transparent",
              color: TEXT,
              ...mono(22, 500),
              cursor: "pointer",
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        style={{
          width: "100%",
          padding: 17,
          borderRadius: 16,
          border: "none",
          ...mono(13, 600, { letterSpacing: 1.5, textTransform: "uppercase" }),
          background: canSave ? ACCENT : "rgba(255,255,255,0.06)",
          color: canSave ? "#0D0D0F" : "rgba(244,243,239,0.3)",
          cursor: canSave ? "pointer" : "default",
        }}
      >
        {saving ? "Adding…" : "Add expense"}
      </button>

      {savedLabel && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 150,
            background: ACCENT,
            color: "#0D0D0F",
            ...mono(12, 600, { letterSpacing: 0.5 }),
            padding: "11px 18px",
            borderRadius: 12,
            boxShadow: "0 10px 26px rgba(127,224,138,0.3)",
            zIndex: 30,
            whiteSpace: "nowrap",
            animation: "fadeUp .25s ease both",
          }}
        >
          ✓ {savedLabel}
        </div>
      )}
    </div>
  );
}
