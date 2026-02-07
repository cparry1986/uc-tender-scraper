import { NextRequest, NextResponse } from "next/server";
import { collectTenders } from "@/lib/collectors";
import { scoreTenders } from "@/lib/scoring";
import { sendDigestEmail } from "@/lib/email";
import { ScrapeResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await collectTenders(1);
    const scored = scoreTenders(raw);
    const eligible = scored.filter((t) => !t.excluded);

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
        daysSearched: 1,
      },
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
