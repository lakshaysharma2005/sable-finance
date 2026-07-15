import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// One row per Plaid Item (a login at one institution).
export const plaidItems = pgTable("plaid_items", {
  id: serial("id").primaryKey(),
  plaidItemId: text("plaid_item_id").notNull().unique(),
  // AES-256-GCM encrypted access token: iv.ciphertext.authTag (hex)
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  syncCursor: text("sync_cursor"),
  // ok | login_required | error
  status: text("status").notNull().default("ok"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Asset categories used by the Accounts screen filter pills.
export type AssetCategory = "cc" | "depo" | "crypto" | "invest" | "betting" | "others";

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  plaidAccountId: text("plaid_account_id").notNull().unique(),
  itemId: integer("item_id")
    .notNull()
    .references(() => plaidItems.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  officialName: text("official_name"),
  customName: text("custom_name"),
  mask: text("mask"),
  type: text("type").notNull(),
  subtype: text("subtype"),
  assetCategory: text("asset_category").$type<AssetCategory>().notNull().default("others"),
  currentBalance: numeric("current_balance", { precision: 14, scale: 2, mode: "number" }),
  availableBalance: numeric("available_balance", { precision: 14, scale: 2, mode: "number" }),
  creditLimit: numeric("credit_limit", { precision: 14, scale: 2, mode: "number" }),
  isoCurrencyCode: text("iso_currency_code"),
  hidden: boolean("hidden").notNull().default(false),
  // UI accent color assigned at link time from the app palette
  color: text("color").notNull().default("#7FE08A"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    plaidTransactionId: text("plaid_transaction_id").notNull().unique(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    authorizedDate: date("authorized_date"),
    name: text("name").notNull(),
    merchantName: text("merchant_name"),
    logoUrl: text("logo_url"),
    // Plaid convention preserved: positive = money out, negative = money in
    amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
    // Manual user override; wins over `amount` when set
    amountOverride: numeric("amount_override", { precision: 14, scale: 2, mode: "number" }),
    isoCurrencyCode: text("iso_currency_code"),
    pending: boolean("pending").notNull().default(false),
    pfcPrimary: text("pfc_primary"),
    pfcDetailed: text("pfc_detailed"),
    // App category derived from PFC mapping at sync time
    category: text("category").notNull().default("Other"),
    // Manual user override; wins over `category` when set
    categoryOverride: text("category_override"),
    note: text("note"),
    removed: boolean("removed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_date_idx").on(t.date),
    index("transactions_account_idx").on(t.accountId),
  ],
);

// User-created spending categories (beyond the built-in defaults).
export const userCategories = pgTable("user_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  emoji: text("emoji").notNull().default("📁"),
  color: text("color").notNull().default("#8A8594"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Friends' portions excluded from a parent expense via the split sheet.
export const transactionSplits = pgTable(
  "transaction_splits",
  {
    id: serial("id").primaryKey(),
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("transaction_splits_tx_idx").on(t.transactionId)],
);

// "Apply to all / create rule" from the category-change sheet.
export const categoryRules = pgTable("category_rules", {
  id: serial("id").primaryKey(),
  // Normalized (lowercased) merchant/name to match against
  merchantMatch: text("merchant_match").notNull().unique(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Daily balance history for the Accounts trend line and MoM deltas.
export const balanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    currentBalance: numeric("current_balance", { precision: 14, scale: 2, mode: "number" }),
    availableBalance: numeric("available_balance", { precision: 14, scale: 2, mode: "number" }),
  },
  (t) => [uniqueIndex("balance_snapshots_account_date_idx").on(t.accountId, t.date)],
);

// Dashboard "To Review" stack: days the user marked as reviewed.
export const reviewedDays = pgTable("reviewed_days", {
  day: date("day").primaryKey(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
});
