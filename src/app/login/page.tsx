"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACCENT, BG, BORDER, CARD, mono, serif, TER, TEXT } from "@/lib/ui";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="shell" style={{ justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div
          style={mono(11, 500, {
            letterSpacing: 3,
            textTransform: "uppercase",
            color: TER,
          })}
        >
          Personal finance
        </div>
        <div style={serif(34, 400, { color: TEXT, marginTop: 10 })}>Sable</div>
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{
            width: "100%",
            background: CARD,
            border: BORDER,
            borderRadius: 14,
            padding: "15px 16px",
            color: TEXT,
            ...serif(16),
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={busy || !password}
          style={{
            width: "100%",
            padding: 15,
            borderRadius: 14,
            border: "none",
            background: ACCENT,
            color: BG,
            ...mono(12, 600, { letterSpacing: 1, textTransform: "uppercase" }),
            cursor: "pointer",
            opacity: busy || !password ? 0.6 : 1,
          }}
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        {error && (
          <div style={{ textAlign: "center", ...mono(11, 400, { color: "#D98A7F" }) }}>{error}</div>
        )}
      </form>
    </div>
  );
}
