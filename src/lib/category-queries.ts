import { eq } from "drizzle-orm";
import { db, categoryRules, transactions, userCategories } from "@/db";
import {
  buildDefaultCategories,
  categoryColor,
  categoryEmoji,
  EXCLUDED_CATEGORIES,
  pickUnusedCategoryColor,
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
  const userByName = new Map(user.map((c) => [c.name, c]));

  const defaults = buildDefaultCategories().map((d) => {
    const override = userByName.get(d.name);
    if (override) {
      userByName.delete(d.name);
      return { ...d, emoji: override.emoji, color: override.color };
    }
    return d;
  });

  const categories = [...defaults, ...userByName.values()];
  const existing = new Set(categories.map((c) => c.name));
  const suggested = SUGGESTED_CATEGORIES.filter((s) => !existing.has(s.name));
  return { categories, suggested };
}

export async function getUsedCategoryColors(excludeName?: string): Promise<Set<string>> {
  const { categories } = await getCategoriesList();
  return new Set(
    categories.filter((c) => c.name !== excludeName).map((c) => c.color.trim().toLowerCase()),
  );
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

  const used = await getUsedCategoryColors();
  const color = pickUnusedCategoryColor(used, input.color);

  const [row] = await db
    .insert(userCategories)
    .values({
      name,
      emoji: input.emoji?.trim() || "📁",
      color,
    })
    .returning();

  return { name: row.name, emoji: row.emoji, color: row.color, isDefault: false };
}

async function allRegisteredNames(): Promise<Set<string>> {
  const user = await getUserCategories();
  return new Set([...SPEND_CATEGORIES, ...user.map((c) => c.name)]);
}

export async function updateCategory(
  oldName: string,
  input: { name?: string; emoji?: string; color?: string },
): Promise<CategoryMeta> {
  if ((EXCLUDED_CATEGORIES as readonly string[]).includes(oldName)) {
    throw new Error("Cannot edit this category");
  }

  const { colors, emojis } = await getCategoryLookups();
  const currentEmoji = resolveCategoryEmoji(oldName, emojis) ?? "📁";
  const currentColor = resolveCategoryColor(oldName, colors);
  const nextName = input.name?.trim() || oldName;
  const nextEmoji = input.emoji?.trim() || currentEmoji;
  const nextColor = input.color?.trim() || currentColor;

  if (!nextName) throw new Error("Category name is required");

  const nameChanging = nextName !== oldName;
  const emojiChanging = nextEmoji !== currentEmoji;
  const colorChanging = nextColor !== currentColor;

  if (!nameChanging && !emojiChanging && !colorChanging) {
    const user = await getUserCategories();
    const existing = user.find((c) => c.name === oldName);
    if (existing) return existing;
    return {
      name: oldName,
      emoji: currentEmoji,
      color: currentColor,
      isDefault: (SPEND_CATEGORIES as readonly string[]).includes(oldName),
    };
  }

  if (nameChanging) {
    const names = await allRegisteredNames();
    if (names.has(nextName)) throw new Error("Category already exists");

    await db.update(transactions).set({ category: nextName }).where(eq(transactions.category, oldName));
    await db.update(transactions).set({ categoryOverride: nextName }).where(eq(transactions.categoryOverride, oldName));
    await db.update(categoryRules).set({ category: nextName }).where(eq(categoryRules.category, oldName));
  }

  const [existing] = await db.select().from(userCategories).where(eq(userCategories.name, oldName)).limit(1);
  if (existing) {
    const [row] = await db
      .update(userCategories)
      .set({
        ...(nameChanging ? { name: nextName } : {}),
        ...(emojiChanging ? { emoji: nextEmoji } : {}),
        ...(colorChanging ? { color: nextColor } : {}),
      })
      .where(eq(userCategories.name, oldName))
      .returning();
    return { name: row.name, emoji: row.emoji, color: row.color, isDefault: false };
  }

  const [row] = await db
    .insert(userCategories)
    .values({
      name: nextName,
      emoji: nextEmoji,
      color: nextColor,
    })
    .returning();

  return { name: row.name, emoji: row.emoji, color: row.color, isDefault: false };
}

/** @deprecated Use updateCategory */
export async function renameCategory(oldName: string, newName: string): Promise<CategoryMeta> {
  return updateCategory(oldName, { name: newName });
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
