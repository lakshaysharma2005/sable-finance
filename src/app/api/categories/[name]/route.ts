import { NextResponse } from "next/server";
import { getCategoryData } from "@/lib/queries";

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
