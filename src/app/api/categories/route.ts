import { NextResponse } from "next/server";
import { createUserCategory, getCategoriesList } from "@/lib/category-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getCategoriesList());
  } catch (e) {
    console.error("GET /api/categories", e);
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; emoji?: string; color?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const category = await createUserCategory({
      name: body.name,
      emoji: body.emoji,
      color: body.color,
    });
    return NextResponse.json(category, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create category";
    console.error("POST /api/categories", e);
    const status = msg.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
