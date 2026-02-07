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
    const { tenders: raw, sourceHealth, recentAwards } = await collectTenders(days);
    const scored = scoreTenders(raw);

    const eligible = scored.filter((t) => !t.excluded);
    const highMedium = eligible.filter(
      (t) => t.priority === "HIGH" || t.priority === "MEDIUM"
    );
    const pipelineValue = highMedium.reduce(
      (sum, t) => sum + (t.value || 0),
      0
    );
    const avgScore =
      eligible.length > 0
        ? Math.round(
            eligible.reduce((s, t) => s + t.score.total, 0) / eligible.length
          )
        : 0;
    const pipelineCount = scored.filter((t) => t.isPipeline).length;

    const result: ScrapeResult = {
      tenders:
        minScore > 0
          ? scored.filter((t) => t.excluded || t.score.total >= minScore)
          : scored,
      stats: {
        totalFound: raw.length,
        afterDedup: raw.length,
        afterExclusions: eligible.length,
        highPriority: eligible.filter((t) => t.priority === "HIGH").length,
        mediumPriority: eligible.filter((t) => t.priority === "MEDIUM").length,
        lowPriority: eligible.filter((t) => t.priority === "LOW").length,
        skipCount: scored.filter(
          (t) => t.excluded || t.priority === "SKIP"
        ).length,
        pipelineCount,
        pipelineValue,
        avgScore,
        scrapedAt: new Date().toISOString(),
        daysSearched: days,
      },
      sourceHealth,
      recentAwards,
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
