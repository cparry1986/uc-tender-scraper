import { NextRequest, NextResponse } from "next/server";
import { collectTenders } from "@/lib/collectors";
import { scoreTenders } from "@/lib/scoring";
import { sendDigestEmail } from "@/lib/email";
import { ScrapeResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { tenders: raw, sourceHealth } = await collectTenders(1);
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
      tenders: scored,
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
        daysSearched: 1,
      },
      sourceHealth,
    };

    await sendDigestEmail(result);

    return NextResponse.json({
      success: true,
      stats: result.stats,
      message: `Digest sent: ${eligible.length} eligible tenders, ${result.stats.highPriority} high priority`,
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: String(error) },
      { status: 500 }
    );
  }
}
