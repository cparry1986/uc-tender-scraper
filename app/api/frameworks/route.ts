import { NextResponse } from "next/server";
import { getFrameworkIntelligence } from "@/lib/frameworks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const intelligence = await getFrameworkIntelligence();
    return NextResponse.json(intelligence);
  } catch (error) {
    console.error("Framework intelligence failed:", error);
    return NextResponse.json(
      { error: "Framework intelligence failed", details: String(error) },
      { status: 500 }
    );
  }
}
