import { NextResponse } from "next/server";
import { getCategoryData } from "@/lib/queries";
import { deleteCategory, updateCategory } from "@/lib/category-queries";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const category = decodeURIComponent(name);
    return NextResponse.json(await getCategoryData(category));
  } catch (e) {
    console.error("GET /api/categories/[name]", e);
    return NextResponse.json({ error: "Failed to load category" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const oldName = decodeURIComponent(name);
    const body = (await req.json()) as { name?: string; emoji?: string; color?: string };
    if (!body.name?.trim() && body.emoji === undefined && !body.color?.trim()) {
      return NextResponse.json({ error: "Name, emoji, or color is required" }, { status: 400 });
    }
    const category = await updateCategory(oldName, { name: body.name, emoji: body.emoji, color: body.color });
    return NextResponse.json(category);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to rename category";
    console.error("PATCH /api/categories/[name]", e);
    const status = msg.includes("already exists") || msg.includes("Cannot rename") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const category = decodeURIComponent(name);
    await deleteCategory(category);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete category";
    console.error("DELETE /api/categories/[name]", e);
    const status = msg.includes("Cannot delete") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
