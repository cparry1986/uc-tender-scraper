import { NextRequest, NextResponse } from "next/server";
import { collectTenders } from "@/lib/collectors";
import { scoreTenders } from "@/lib/scoring";
import { ScrapeResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const days = Math.min(Number(params.get("days")) || 3, 30);
  const minScore = Number(params.get("minScore")) || 0;

  try {
    const raw = await collectTenders(days);
    const scored = scoreTenders(raw);

    const eligible = scored.filter((t) => !t.excluded);
    const filtered = minScore > 0
      ? eligible.filter((t) => t.score.total >= minScore)
      : eligible;

    const result: ScrapeResult = {
      tenders: scored,
      stats: {
        totalFound: raw.length,
        afterDedup: raw.length,
        afterExclusions: eligible.length,
        highPriority: eligible.filter((t) => t.score.total >= 65).length,
        mediumPriority: eligible.filter(
          (t) => t.score.total >= 40 && t.score.total < 65
        ).length,
        lowPriority: eligible.filter((t) => t.score.total < 40).length,
        scrapedAt: new Date().toISOString(),
        daysSearched: days,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Scrape failed:", error);
    return NextResponse.json(
      { error: "Scrape failed", details: String(error) },
      { status: 500 }
    );
  }
}
