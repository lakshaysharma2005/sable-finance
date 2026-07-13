// App spending categories — names and colors come from the design prototype.

// Distinct colors for category charts and the color picker.
export const CATEGORY_PALETTE = [
  "#E6262D",
  "#EA451C",
  "#ED631B",
  "#EF8935",
  "#BC792D",
  "#DAA329",
  "#E8BE2B",
  "#F2D630",
  "#AFB927",
  "#41AF24",
  "#45C290",
  "#44BCD5",
  "#3787F8",
  "#845DF9",
  "#9C51F6",
  "#B247F5",
  "#C73DF4",
  "#EA1CC7",
  "#E93C69",
  "#8D94A4",
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drink": CATEGORY_PALETTE[9],
  Shopping: CATEGORY_PALETTE[3],
  Bills: CATEGORY_PALETTE[19],
  Transport: CATEGORY_PALETTE[12],
  Entertainment: CATEGORY_PALETTE[15],
  Health: CATEGORY_PALETTE[18],
  Income: CATEGORY_PALETTE[8],
  Transfer: CATEGORY_PALETTE[11],
  Other: CATEGORY_PALETTE[13],
};

function normalizeHex(color: string): string {
  return color.trim().toLowerCase();
}

/** Pick a palette color not already used; falls back to a generated hue if the palette is full. */
export function pickUnusedCategoryColor(used: Set<string>, preferred?: string): string {
  const taken = new Set([...used].map(normalizeHex));
  if (preferred && !taken.has(normalizeHex(preferred))) return preferred;
  for (const color of CATEGORY_PALETTE) {
    if (!taken.has(normalizeHex(color))) return color;
  }
  const hue = (taken.size * 47) % 360;
  return `hsl(${hue}, 45%, 65%)`;
}

export const SPEND_CATEGORIES = [
  "Food & Drink",
  "Shopping",
  "Bills",
  "Transport",
  "Entertainment",
  "Health",
  "Other",
] as const;

export interface CategoryMeta {
  name: string;
  emoji: string | null;
  color: string;
  isDefault: boolean;
}

// Preset categories shown in the "Add a category" picker.
export const SUGGESTED_CATEGORIES: { name: string; emoji: string; color: string }[] = [
  { name: "Car", emoji: "🚗", color: CATEGORY_PALETTE[12] },
  { name: "Gym", emoji: "👟", color: CATEGORY_PALETTE[0] },
  { name: "Healthcare", emoji: "💊", color: CATEGORY_PALETTE[18] },
  { name: "Recreation", emoji: "🎫", color: CATEGORY_PALETTE[14] },
  { name: "Sports", emoji: "🚴", color: CATEGORY_PALETTE[10] },
  { name: "Subscriptions", emoji: "💳", color: CATEGORY_PALETTE[13] },
  { name: "Transportation", emoji: "🚌", color: CATEGORY_PALETTE[12] },
  { name: "Travel & Vacation", emoji: "🏖️", color: CATEGORY_PALETTE[11] },
  { name: "Utilities", emoji: "🔌", color: CATEGORY_PALETTE[7] },
];

const DEFAULT_EMOJI: Partial<Record<string, string>> = {
  "Food & Drink": "🍽️",
  Shopping: "🛍️",
  Bills: "📄",
  Transport: "🚗",
  Entertainment: "🎬",
  Health: "💊",
  Other: "📁",
  Income: "💵",
  Transfer: "↔️",
};

// Categories excluded from spending stats (Stats "Excluded" tab).
export const EXCLUDED_CATEGORIES = ["Income", "Transfer"] as const;

// Plaid personal_finance_category.primary -> app category.
const PFC_TO_APP: Record<string, string> = {
  INCOME: "Income",
  TRANSFER_IN: "Transfer",
  TRANSFER_OUT: "Transfer",
  // Credit card / loan payments are internal money movement, not spend
  LOAN_PAYMENTS: "Transfer",
  BANK_FEES: "Bills",
  ENTERTAINMENT: "Entertainment",
  FOOD_AND_DRINK: "Food & Drink",
  GENERAL_MERCHANDISE: "Shopping",
  HOME_IMPROVEMENT: "Shopping",
  MEDICAL: "Health",
  PERSONAL_CARE: "Health",
  GENERAL_SERVICES: "Bills",
  GOVERNMENT_AND_NON_PROFIT: "Bills",
  TRANSPORTATION: "Transport",
  TRAVEL: "Transport",
  RENT_AND_UTILITIES: "Bills",
};

export function mapPfcToCategory(pfcPrimary: string | null | undefined): string {
  if (!pfcPrimary) return "Other";
  return PFC_TO_APP[pfcPrimary] ?? "Other";
}

export function categoryColor(category: string, extra?: Record<string, string>): string {
  return extra?.[category] ?? CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;
}

export function categoryEmoji(category: string, extra?: Record<string, string | null>): string | null {
  if (extra && category in extra) return extra[category] ?? null;
  return DEFAULT_EMOJI[category] ?? null;
}

export function buildDefaultCategories(): CategoryMeta[] {
  return SPEND_CATEGORIES.map((name) => ({
    name,
    emoji: DEFAULT_EMOJI[name] ?? null,
    color: CATEGORY_COLORS[name],
    isDefault: true,
  }));
}

// Asset category labels + colors for the Accounts screen (from the prototype).
export const ASSET_CATEGORIES = [
  { key: "cc", label: "Credit cards", color: "#D98A7F" },
  { key: "depo", label: "Banking", color: "#7FE08A" },
  { key: "crypto", label: "Crypto", color: "#C49A6B" },
  { key: "invest", label: "Stocks", color: "#6B8AB0" },
  { key: "betting", label: "Betting", color: "#B07E8A" },
  { key: "others", label: "Others", color: "#8A8594" },
] as const;

export type AssetCategoryKey = (typeof ASSET_CATEGORIES)[number]["key"];

// Plaid account type -> asset category bucket.
export function mapAccountTypeToAssetCategory(type: string): AssetCategoryKey {
  switch (type) {
    case "credit":
      return "cc";
    case "depository":
      return "depo";
    case "investment":
    case "brokerage":
      return "invest";
    default:
      return "others";
  }
}

// Account accent colors assigned round-robin at link time (prototype palette).
export const ACCOUNT_COLORS = ["#7FE08A", "#6B8AB0", "#C49A6B", "#B07E8A", "#8A8594", "#D98A7F"];
