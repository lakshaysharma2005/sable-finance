import { eq } from "drizzle-orm";
import { db, categoryRules, transactions, userCategories } from "@/db";
import {
  buildDefaultCategories,
  categoryColor,
  categoryEmoji,
  EXCLUDED_CATEGORIES,
  SUGGESTED_CATEGORIES,
  SPEND_CATEGORIES,
  type CategoryMeta,
} from "@/lib/categories";

export interface CategoriesListData {
  categories: CategoryMeta[];
  suggested: { name: string; emoji: string; color: string }[];
}

export async function getUserCategories(): Promise<CategoryMeta[]> {
  const rows = await db.select().from(userCategories).orderBy(userCategories.name);
  return rows.map((r) => ({
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    isDefault: false,
  }));
}

export async function getCategoriesList(): Promise<CategoriesListData> {
  const user = await getUserCategories();
  const existing = new Set([...SPEND_CATEGORIES, ...user.map((c) => c.name)]);
  const suggested = SUGGESTED_CATEGORIES.filter((s) => !existing.has(s.name));
  return {
    categories: [...buildDefaultCategories(), ...user],
    suggested,
  };
}

export async function createUserCategory(input: {
  name: string;
  emoji?: string;
  color?: string;
}): Promise<CategoryMeta> {
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required");

  const allNames = new Set([
    ...SPEND_CATEGORIES,
    ...(await getUserCategories()).map((c) => c.name),
  ]);
  if (allNames.has(name)) throw new Error("Category already exists");

  const [row] = await db
    .insert(userCategories)
    .values({
      name,
      emoji: input.emoji?.trim() || "📁",
      color: input.color ?? categoryColor(name),
    })
    .returning();

  return { name: row.name, emoji: row.emoji, color: row.color, isDefault: false };
}

async function allRegisteredNames(): Promise<Set<string>> {
  const user = await getUserCategories();
  return new Set([...SPEND_CATEGORIES, ...user.map((c) => c.name)]);
}

export async function renameCategory(oldName: string, newName: string): Promise<CategoryMeta> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Category name is required");
  if (trimmed === oldName) {
    const user = await getUserCategories();
    const existing = user.find((c) => c.name === oldName);
    if (existing) return existing;
    return {
      name: oldName,
      emoji: categoryEmoji(oldName),
      color: categoryColor(oldName),
      isDefault: (SPEND_CATEGORIES as readonly string[]).includes(oldName),
    };
  }

  if ((EXCLUDED_CATEGORIES as readonly string[]).includes(oldName)) {
    throw new Error("Cannot rename this category");
  }

  const names = await allRegisteredNames();
  if (names.has(trimmed)) throw new Error("Category already exists");

  await db.update(transactions).set({ category: trimmed }).where(eq(transactions.category, oldName));
  await db.update(transactions).set({ categoryOverride: trimmed }).where(eq(transactions.categoryOverride, oldName));
  await db.update(categoryRules).set({ category: trimmed }).where(eq(categoryRules.category, oldName));

  const [existing] = await db.select().from(userCategories).where(eq(userCategories.name, oldName)).limit(1);
  if (existing) {
    const [row] = await db
      .update(userCategories)
      .set({ name: trimmed })
      .where(eq(userCategories.name, oldName))
      .returning();
    return { name: row.name, emoji: row.emoji, color: row.color, isDefault: false };
  }

  const { colors, emojis } = await getCategoryLookups();
  const [row] = await db
    .insert(userCategories)
    .values({
      name: trimmed,
      emoji: categoryEmoji(oldName, emojis) ?? "📁",
      color: categoryColor(oldName, colors),
    })
    .returning();

  return { name: row.name, emoji: row.emoji, color: row.color, isDefault: false };
}

/** Color + emoji maps for transaction display. */
export async function getCategoryLookups(): Promise<{
  colors: Record<string, string>;
  emojis: Record<string, string | null>;
}> {
  const user = await getUserCategories();
  const colors: Record<string, string> = {};
  const emojis: Record<string, string | null> = {};
  for (const c of user) {
    colors[c.name] = c.color;
    emojis[c.name] = c.emoji;
  }
  return { colors, emojis };
}

export function resolveCategoryColor(name: string, colors: Record<string, string>): string {
  return categoryColor(name, colors);
}

export function resolveCategoryEmoji(name: string, emojis: Record<string, string | null>): string | null {
  return categoryEmoji(name, emojis);
}
