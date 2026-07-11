import { NextResponse } from "next/server";
import { getCategoryData } from "@/lib/queries";
import { updateCategory } from "@/lib/category-queries";

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
    const body = (await req.json()) as { name?: string; emoji?: string };
    if (!body.name?.trim() && body.emoji === undefined) {
      return NextResponse.json({ error: "Name or emoji is required" }, { status: 400 });
    }
    const category = await updateCategory(oldName, { name: body.name, emoji: body.emoji });
    return NextResponse.json(category);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to rename category";
    console.error("PATCH /api/categories/[name]", e);
    const status = msg.includes("already exists") || msg.includes("Cannot rename") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
