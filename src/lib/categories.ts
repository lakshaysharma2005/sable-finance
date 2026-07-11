// App spending categories — names and colors come from the design prototype.

export const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drink": "#7FE08A",
  Shopping: "#C49A6B",
  Bills: "#8A8594",
  Transport: "#6B8AB0",
  Entertainment: "#B07E8A",
  Health: "#D98A7F",
  Income: "#7FE08A",
  Transfer: "#8A8594",
  Other: "#8A8594",
};

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
  { name: "Beauty", emoji: "💄", color: "#B07E8A" },
  { name: "Car", emoji: "🚗", color: "#6B8AB0" },
  { name: "Children", emoji: "🚸", color: "#C49A6B" },
  { name: "Dance", emoji: "💃", color: "#B07E8A" },
  { name: "Donations", emoji: "🤝", color: "#7FE08A" },
  { name: "Gym", emoji: "👟", color: "#D98A7F" },
  { name: "Healthcare", emoji: "💊", color: "#D98A7F" },
  { name: "Home", emoji: "🏠", color: "#C49A6B" },
  { name: "Loans", emoji: "💰", color: "#8A8594" },
  { name: "Pets", emoji: "🐶", color: "#C49A6B" },
  { name: "Recreation", emoji: "🎫", color: "#B07E8A" },
  { name: "Senior Care", emoji: "👵", color: "#6B8AB0" },
  { name: "Sports", emoji: "🚴", color: "#6B8AB0" },
  { name: "Subscriptions", emoji: "💳", color: "#8A8594" },
  { name: "Transportation", emoji: "🚌", color: "#6B8AB0" },
  { name: "Travel & Vacation", emoji: "🏖️", color: "#6B8AB0" },
  { name: "Utilities", emoji: "🔌", color: "#8A8594" },
  { name: "Yoga & Pilates", emoji: "🧘", color: "#D98A7F" },
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
