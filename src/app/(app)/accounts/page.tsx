"use client";

import { useMemo, useState } from "react";
import { DotsIcon } from "@/components/Icons";
import { usePlaidConnect } from "@/components/PlaidLinkButton";
import { Sheet } from "@/components/Sheet";
import { MINUS, money } from "@/lib/format";
import type { AccountsData } from "@/lib/queries";
import { ACCENT, card, chipBase, chipOff, chipOn, CREDIT_CARD_ASPECT, microLabel, mono, serif, TER, TEXT } from "@/lib/ui";
import { useData } from "@/lib/useData";

type Acct = AccountsData["accounts"][number];

const ALL_KEYS = ["cc", "depo", "crypto", "invest", "betting", "others"];

const CONNECTION_LOGOS: Record<string, string> = {
  kalshi: "/icons/kalshi.png?v=2",
  venmo: "/icons/venmo.png?v=2",
  chase: "/icons/chase.png?v=2",
};

function isChaseChecking(a: Acct): boolean {
  if (a.subtype !== "checking") return false;
  const haystack = [a.institutionName, a.name, a.officialName].filter(Boolean).join(" ");
  return /chase/i.test(haystack);
}

function isVenmoAccount(a: Acct): boolean {
  const key = (a.name || a.officialName || "").toLowerCase().trim();
  return key.includes("venmo");
}

function showSecondAccountStat(a: Acct): boolean {
  if (isVenmoAccount(a)) return false;
  if (a.assetCategory === "depo") return false;
  return true;
}

/** Institution/connection logo for non-bank accounts (Betting, etc.). */
function connectionLogo(a: Acct): string | null {
  const key = (a.name || a.officialName || "").toLowerCase().trim();
  if (key.includes("kalshi")) return CONNECTION_LOGOS.kalshi;
  if (isVenmoAccount(a)) return CONNECTION_LOGOS.venmo;
  if (isChaseChecking(a)) return CONNECTION_LOGOS.chase;
  return null;
}

function isSquareBrandLogo(logo: string): boolean {
  return logo === CONNECTION_LOGOS.venmo || logo === CONNECTION_LOGOS.chase;
}

function squareBrandSlotStyle(size: "thumb" | "detail"): React.CSSProperties {
  return {
    width: size === "thumb" ? 82 : 100,
    aspectRatio: CREDIT_CARD_ASPECT,
    flex: "none",
    display: "grid",
    placeItems: "center",
    ...(size === "detail" ? { marginBottom: 20 } : {}),
  };
}

function squareBrandLogoImgStyle(size: "thumb" | "detail"): React.CSSProperties {
  const dim = size === "thumb" ? 50 : 92;
  return {
    width: dim,
    height: dim,
    borderRadius: size === "thumb" ? 12 : 14,
    objectFit: "contain",
    objectPosition: "center",
    display: "block",
  };
}

function connectionLogoStyle(logo: string, size: "thumb" | "detail"): React.CSSProperties {
  const width = size === "thumb" ? 82 : 100;
  return {
    width,
    aspectRatio: CREDIT_CARD_ASPECT,
    borderRadius: size === "thumb" ? 10 : 12,
    flex: "none",
    objectFit: "contain",
    objectPosition: "center",
    background: "transparent",
    padding: size === "thumb" ? "10px 8px" : "12px 10px",
    boxSizing: "border-box",
    ...(size === "detail" ? { marginBottom: 20 } : {}),
  };
}

function ConnectionLogo({ logo, size }: { logo: string; size: "thumb" | "detail" }) {
  if (isSquareBrandLogo(logo)) {
    return (
      <div style={squareBrandSlotStyle(size)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" style={squareBrandLogoImgStyle(size)} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" style={connectionLogoStyle(logo, size)} />
  );
}

function cardTheme(a: Acct): { grad: string; accent: string; typeLabel: string } {
  if (a.assetCategory === "cc") {
    return { grad: "linear-gradient(135deg,#2a1a14,#3d200f)", accent: "#D98A7F", typeLabel: "CREDIT" };
  }
  if (a.assetCategory === "betting" || a.subtype === "betting") {
    return { grad: "linear-gradient(135deg,#2a1418,#3d1a22)", accent: "#B07E8A", typeLabel: "BETTING" };
  }
  if (a.subtype === "savings") {
    return { grad: "linear-gradient(135deg,#0f1f2e,#1a2e42)", accent: "#6B8AB0", typeLabel: "SAVINGS" };
  }
  if (a.subtype === "checking") {
    return { grad: "linear-gradient(135deg,#0f2a1e,#1a3d2a)", accent: "#7FE08A", typeLabel: "CHECKING" };
  }
  return { grad: "linear-gradient(135deg,#1c1c22,#26262e)", accent: "#8A8594", typeLabel: (a.subtype ?? a.type).toUpperCase() };
}

function AccountThumb({ account }: { account: Acct }) {
  const theme = cardTheme(account);
  const logo = connectionLogo(account);

  if (logo) {
    return <ConnectionLogo logo={logo} size="thumb" />;
  }

  return (
    <div
      style={{
        width: 82,
        aspectRatio: CREDIT_CARD_ASPECT,
        borderRadius: 10,
        background: theme.grad,
        padding: "9px 10px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        flex: "none",
        boxSizing: "border-box",
      }}
    >
      <span style={mono(9, 700, { color: theme.accent, letterSpacing: 0.5 })}>{theme.typeLabel}</span>
      <span style={mono(10, 400, { color: theme.accent, opacity: 0.7 })}>••{account.mask ?? "????"}</span>
    </div>
  );
}

function fmtSignedBal(n: number): string {
  return (n < 0 ? MINUS : "") + money(Math.abs(n), 2);
}

export default function AccountsPage() {
  const { data, reload } = useData<AccountsData>("/api/accounts");
  const [selCats, setSelCats] = useState<string[]>(ALL_KEYS);
  const [view, setView] = useState<"bar" | "trend">("bar");
  const [open, setOpen] = useState<Record<string, boolean>>({ cc: true, depo: true });
  const [detailAcct, setDetailAcct] = useState<Acct | null>(null);

  const { start: startLink } = usePlaidConnect(() => window.location.reload());

  /** Prefer adding accounts onto an existing Item (update mode) so re-selecting Chase doesn't clone cards. */
  function startAddForCategory(catKey: string) {
    const catAccounts = data?.accounts.filter((a) => a.assetCategory === catKey) ?? [];
    if (catAccounts.length === 0) {
      startLink();
      return;
    }
    // Prefer an Item that already needs re-auth; otherwise the earliest-linked Item in this category
    // (keeps history/categorizations on the original connection).
    const needsRelink = catAccounts.find((a) => a.needsRelink);
    const oldest = [...catAccounts].sort((a, b) => a.id - b.id)[0];
    const itemId = needsRelink?.itemId ?? oldest.itemId;
    startLink({ itemId, accountSelection: true });
  }

  const allActive = selCats.length === ALL_KEYS.length;

  const selected = useMemo(() => {
    if (!data) return { total: 0, nonzero: [] as AccountsData["assetCats"] };
    const cats = data.assetCats.filter((c) => selCats.includes(c.key));
    return {
      total: cats.reduce((s, c) => s + c.amt, 0),
      // Assets (green) first, then liabilities (red); larger abs within each group.
      nonzero: cats
        .filter((c) => c.amt !== 0)
        .sort((a, b) => {
          const aPos = a.amt >= 0 ? 0 : 1;
          const bPos = b.amt >= 0 ? 0 : 1;
          if (aPos !== bPos) return aPos - bPos;
          return Math.abs(b.amt) - Math.abs(a.amt);
        }),
    };
  }, [data, selCats]);

  const connectedCats = data?.assetCats.filter((c) => c.connected) ?? [];
  const notConnected = data?.assetCats.filter((c) => !c.connected) ?? [];

  return (
    <div style={{ animation: "fadeUp .3s ease both" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={serif(22, 400, { color: TEXT })}>Accounts</div>
      </div>

      {/* filter pills */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, marginBottom: 14 }}>
        <button
          onClick={() => setSelCats(allActive ? [] : [...ALL_KEYS])}
          style={{ ...chipBase, ...(allActive ? chipOn : chipOff) }}
        >
          All
        </button>
        {data?.assetCats.map((c) => (
          <button
            key={c.key}
            onClick={() =>
              setSelCats((cur) => (cur.includes(c.key) ? cur.filter((k) => k !== c.key) : [...cur, c.key]))
            }
            style={{ ...chipBase, ...(selCats.includes(c.key) ? chipOn : chipOff) }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* selected balance card */}
      <div style={{ ...card, padding: "20px 20px 18px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ ...microLabel, color: "rgba(244,243,239,0.45)" }}>Selected balance</div>
            <div style={mono(34, 500, { color: TEXT, letterSpacing: -1, marginTop: 8 })}>{fmtSignedBal(selected.total)}</div>
            <div
              style={mono(10, 400, {
                color: allActive && data ? ACCENT : "rgba(244,243,239,0.45)",
                marginTop: 8,
              })}
            >
              {data
                ? allActive
                  ? `${data.momDelta >= 0 ? "+" : MINUS}${money(Math.abs(data.momDelta))} (${Math.abs(data.momPct).toFixed(1)}%) vs last month`
                  : `${selCats.length} of ${ALL_KEYS.length} selected`
                : ""}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 2,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 10,
              padding: 2,
              flex: "none",
              marginTop: 2,
            }}
          >
            {(["bar", "trend"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={v === "bar" ? "Composition view" : "Trend view"}
                style={{
                  width: 30,
                  height: 26,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all .2s",
                  background: view === v ? ACCENT : "transparent",
                }}
              >
                {v === "bar" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={view === v ? "#0D0D0F" : "rgba(244,243,239,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="10" width="4" height="10" rx="1" />
                    <rect x="10" y="5" width="4" height="15" rx="1" />
                    <rect x="17" y="13" width="4" height="7" rx="1" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={view === v ? "#0D0D0F" : "rgba(244,243,239,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17l6-7 4 4 8-9" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {view === "bar" ? (
          <CompositionBar segments={selected.nonzero} />
        ) : (
          <TrendLine data={data} allActive={allActive} selCats={selCats} />
        )}
      </div>

      {/* connected category sections */}
      {connectedCats.map((cat) => {
        const catAccounts = data!.accounts.filter((a) => a.assetCategory === cat.key);
        const isOpen = open[cat.key] ?? true;
        return (
          <div key={cat.key} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [cat.key]: !isOpen }))}
                style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <span style={mono(9, 400, { color: "rgba(244,243,239,0.4)" })}>{isOpen ? "▼" : "▶"}</span>
                <span style={serif(16, 400, { color: TEXT })}>{cat.label}</span>
                <span style={mono(12, 500, { color: cat.key === "cc" ? cat.color : ACCENT, marginLeft: 2 })}>
                  {money(Math.abs(cat.amt))}
                </span>
              </button>
              {cat.key !== "betting" && (
                <span
                  onClick={() => startAddForCategory(cat.key)}
                  style={{ ...mono(10, 400, { color: "rgba(244,243,239,0.28)" }), cursor: "pointer" }}
                >
                  Add ›
                </span>
              )}
            </div>
            {isOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {catAccounts.map((a) => (
                  <AccountRow key={a.id} account={a} data={data!} onClick={() => setDetailAcct(a)} onRelinked={reload} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {data && data.accounts.length === 0 && (
        <div style={{ ...card, borderRadius: 16, padding: 22, textAlign: "center", marginBottom: 14 }}>
          <div style={serif(15, 400, { color: TEXT, marginBottom: 12 })}>No accounts connected yet</div>
          <button
            onClick={() => startLink()}
            style={{
              padding: "12px 22px",
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

      {/* not connected */}
      {notConnected.length > 0 && (
        <div style={{ ...card, borderRadius: 16, padding: 4 }}>
          <div style={{ ...microLabel, letterSpacing: 1, color: "rgba(244,243,239,0.35)", padding: "10px 12px 4px" }}>
            Not connected yet
          </div>
          {notConnected.map((n) => (
            <div key={n.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px" }}>
              <span style={serif(13, 400, { color: "rgba(244,243,239,0.55)" })}>{n.label}</span>
              <span style={mono(10, 400, { color: TER })}>{n.key === "cc" || n.key === "depo" ? "Connect ›" : "Coming later"}</span>
            </div>
          ))}
        </div>
      )}

      {/* account detail sheet */}
      {detailAcct && (
        <AccountDetailSheet
          account={detailAcct}
          data={data!}
          onClose={() => setDetailAcct(null)}
          onRenamed={() => {
            setDetailAcct(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

// 3D isometric composition bar (extruded prism), ported from the prototype.
function CompositionBar({ segments }: { segments: AccountsData["assetCats"] }) {
  const barW = 300;
  const dx = 18;
  const dy = 18;
  const frontH = 50;
  const sumAbs = segments.reduce((s, c) => s + Math.abs(c.amt), 0) || 1;

  let cum = 0;
  const polys = segments.map((c) => {
    const w = (Math.abs(c.amt) / sumAbs) * barW;
    const x0 = dx + cum;
    const x1 = dx + cum + w;
    cum += w;
    const front = `${x0.toFixed(1)},${dy} ${x1.toFixed(1)},${dy} ${x1.toFixed(1)},${dy + frontH} ${x0.toFixed(1)},${dy + frontH}`;
    const top = `${x0.toFixed(1)},${dy} ${x1.toFixed(1)},${dy} ${(x1 - dx).toFixed(1)},0 ${(x0 - dx).toFixed(1)},0`;
    return { color: c.color, front, top };
  });
  const leftCap = `${dx},${dy} ${dx},${dy + frontH} 0,${frontH} 0,0`;

  return (
    <>
      <div style={{ marginTop: 20 }}>
        {polys.length > 0 ? (
          <svg viewBox={`0 0 ${dx + barW} ${dy + frontH}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}>
            <polygon points={leftCap} fill={segments[0].color} stroke="#161618" strokeWidth="2" />
            {polys.map((p, i) => (
              <g key={i}>
                <polygon points={p.top} fill={p.color} stroke="#161618" strokeWidth="2" />
                <polygon points={p.front} fill={p.color} stroke="#161618" strokeWidth="2" />
              </g>
            ))}
          </svg>
        ) : (
          <div style={{ padding: "18px 0 4px", textAlign: "center", ...serif(13, 400, { color: "rgba(244,243,239,0.35)" }) }}>
            Nothing selected
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 13 }}>
        {segments.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, flex: "none", background: s.color }} />
            <span style={{ flex: 1, ...serif(13, 400, { color: "rgba(244,243,239,0.7)" }) }}>{s.label}</span>
            <span style={mono(12, 400, { color: TEXT })}>{fmtSignedBal(s.amt)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function TrendLine({ data, allActive, selCats }: { data: AccountsData | null; allActive: boolean; selCats: string[] }) {
  const points = useMemo(() => {
    if (!data || data.trend.length === 0) return [];
    const catByAccount = new Map(data.accounts.map((a) => [a.id, a.assetCategory]));
    return data.trend.map((p) => {
      let total = 0;
      for (const [acctId, val] of Object.entries(p.byAccount)) {
        const cat = catByAccount.get(Number(acctId));
        if (cat && selCats.includes(cat)) total += val;
      }
      return { date: p.date, total };
    });
  }, [data, selCats]);

  if (points.length < 2) {
    return (
      <div style={{ marginTop: 16, padding: "20px 0", textAlign: "center", ...serif(13, 400, { color: "rgba(244,243,239,0.35)" }) }}>
        Trend appears after a few days of balance history
      </div>
    );
  }

  const w = 320;
  const h = 90;
  const padY = 8;
  const vals = points.map((p) => p.total);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = w / (points.length - 1);
  const pts = vals.map((v, i) => ({ x: i * stepX, y: padY + (h - 2 * padY) * (1 - (v - min) / range) }));
  const line = "M" + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${h} L0,${h} Z`;
  const last = pts[pts.length - 1];

  return (
    <div style={{ marginTop: 16 }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", height: 82 }}>
        <defs>
          <linearGradient id="acctTrendG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7FE08A" stopOpacity=".22" />
            <stop offset="100%" stopColor="#7FE08A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#acctTrendG)" />
        <path d={line} fill="none" stroke="#7FE08A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="7" fill="#7FE08A" opacity="0.22" />
        <circle cx={last.x} cy={last.y} r="3.5" fill="#7FE08A" />
      </svg>
      <div style={mono(10, 400, { color: TER, marginTop: 2 })}>
        {allActive ? "Full portfolio · balance history" : "Trend for selected categories"}
      </div>
    </div>
  );
}

function acctChangePct(account: Acct, data: AccountsData): number | null {
  const points = data.trend
    .map((p) => ({ date: p.date, val: p.byAccount[account.id] }))
    .filter((p) => p.val !== undefined);
  if (points.length < 2) return null;
  const monthAgoIso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const past = points.filter((p) => p.date <= monthAgoIso).at(-1) ?? points[0];
  const now = points[points.length - 1];
  if (!past || past.val === 0) return null;
  return ((now.val - past.val) / Math.abs(past.val)) * 100;
}

function AccountRow({
  account,
  data,
  onClick,
  onRelinked,
}: {
  account: Acct;
  data: AccountsData;
  onClick: () => void;
  onRelinked: () => void;
}) {
  const { start: relink } = usePlaidConnect(onRelinked, account.itemId);
  const isCredit = account.assetCategory === "cc";
  const showSecondStat = showSecondAccountStat(account);
  const utilization =
    isCredit && account.creditLimit ? Math.round(((account.currentBalance ?? 0) / account.creditLimit) * 100) : null;
  const change = showSecondStat && !isCredit ? acctChangePct(account, data) : null;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "#161618",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: 13,
        cursor: "pointer",
      }}
    >
      <AccountThumb account={account} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={serif(14, 400, {
            color: TEXT,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 9,
          })}
        >
          {account.name}
        </div>
        {account.needsRelink ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              relink();
            }}
            style={{
              border: "1px solid rgba(217,138,127,0.4)",
              background: "rgba(217,138,127,0.14)",
              color: "#D98A7F",
              ...mono(10, 600, { letterSpacing: 0.5 }),
              padding: "6px 12px",
              borderRadius: 9,
              cursor: "pointer",
            }}
          >
            Re-link required
          </button>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <div style={{ ...microLabel, fontSize: 8, color: "rgba(244,243,239,0.38)" }}>
                {isCredit ? "Balance" : "Available"}
              </div>
              <div style={mono(13, 500, { color: TEXT, marginTop: 5 })}>
                {money(Math.abs(isCredit ? (account.currentBalance ?? 0) : (account.availableBalance ?? account.currentBalance ?? 0)))}
              </div>
            </div>
            {showSecondStat && (
              <div>
                <div style={{ ...microLabel, fontSize: 8, color: "rgba(244,243,239,0.38)" }}>
                  {isCredit ? "Utilized" : "Change"}
                </div>
                {isCredit ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
                    <span style={mono(13, 500, { color: "#C49A6B" })}>{utilization !== null ? `${utilization}%` : "—"}</span>
                    {utilization !== null && (
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C49A6B", flex: "none" }} />
                    )}
                  </div>
                ) : (
                  <div style={mono(13, 500, { color: change !== null && change >= 0 ? ACCENT : change !== null ? "#D98A7F" : TER, marginTop: 5 })}>
                    {change !== null ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}% ${change >= 0 ? "▲" : "▼"}` : "—"}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AccountDetailSheet({
  account,
  data,
  onClose,
  onRenamed,
}: {
  account: Acct;
  data: AccountsData;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const theme = cardTheme(account);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(account.name);

  const isCredit = account.assetCategory === "cc";
  const showSecondStat = showSecondAccountStat(account);
  const utilization =
    isCredit && account.creditLimit ? Math.round(((account.currentBalance ?? 0) / account.creditLimit) * 100) : null;
  const change = showSecondStat && !isCredit ? acctChangePct(account, data) : null;
  const logo = connectionLogo(account);

  async function saveRename() {
    if (!draft.trim()) return;
    await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customName: draft }),
    });
    onRenamed();
  }

  return (
    <Sheet onClose={onClose} background="#161618" zIndex={35} style={{ padding: "0 20px 28px" }}>
      {renaming ? (
        <>
          <div
            style={{
              textAlign: "center",
              ...mono(11, 600, { letterSpacing: 2.5, textTransform: "uppercase", color: ACCENT }),
              padding: "6px 0 18px",
            }}
          >
            Rename account
          </div>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Account name"
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
              marginBottom: 16,
            }}
          />
          <button
            onClick={saveRename}
            style={{
              width: "100%",
              padding: 15,
              borderRadius: 14,
              border: "none",
              background: ACCENT,
              color: "#0D0D0F",
              ...mono(12, 600, { letterSpacing: 1, textTransform: "uppercase" }),
              cursor: "pointer",
            }}
          >
            Save
          </button>
          <button
            onClick={() => setRenaming(false)}
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
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "0 0 18px" }}>
            <div>
              <div style={{ ...microLabel, color: theme.accent }}>{theme.typeLabel}</div>
              <div style={serif(22, 400, { color: TEXT, marginTop: 5 })}>{account.name}</div>
            </div>
            <div style={{ position: "relative", flex: "none" }}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
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
                    top: 42,
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
                      setRenaming(true);
                      setMenuOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      padding: "11px 12px",
                      borderRadius: 9,
                      ...serif(14, 400, { color: TEXT }),
                      cursor: "pointer",
                    }}
                  >
                    Rename account
                  </button>
                </div>
              )}
            </div>
          </div>

          {logo ? (
            <ConnectionLogo logo={logo} size="detail" />
          ) : (
            <div
              style={{
                width: 100,
                aspectRatio: CREDIT_CARD_ASPECT,
                borderRadius: 12,
                background: theme.grad,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                marginBottom: 20,
                boxSizing: "border-box",
              }}
            >
              <span style={mono(10, 700, { color: theme.accent, letterSpacing: 0.5 })}>{theme.typeLabel}</span>
              <span style={mono(11, 400, { color: theme.accent, opacity: 0.75 })}>••{account.mask ?? "????"}</span>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: showSecondStat ? "1fr 1fr" : "1fr",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 16,
              padding: "18px 12px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ ...microLabel, fontSize: 9, color: "rgba(244,243,239,0.4)" }}>{isCredit ? "Balance" : "Available"}</div>
              <div style={mono(17, 500, { color: TEXT, marginTop: 6 })}>
                {money(Math.abs(isCredit ? (account.currentBalance ?? 0) : (account.availableBalance ?? account.currentBalance ?? 0)))}
              </div>
            </div>
            {showSecondStat && (
              <div style={{ textAlign: "center" }}>
                <div style={{ ...microLabel, fontSize: 9, color: "rgba(244,243,239,0.4)" }}>{isCredit ? "Utilized" : "Change"}</div>
                <div
                  style={mono(17, 500, {
                    color: isCredit ? "#C49A6B" : change !== null && change >= 0 ? ACCENT : change !== null ? "#D98A7F" : TER,
                    marginTop: 6,
                  })}
                >
                  {isCredit
                    ? utilization !== null
                      ? `${utilization}%`
                      : "—"
                    : change !== null
                      ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}% ${change >= 0 ? "▲" : "▼"}`
                      : "—"}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
