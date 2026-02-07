import { Resend } from "resend";
import { ScoredTender, ScrapeResult } from "./types";

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

function formatValue(value: number | null): string {
  if (!value) return "Not disclosed";
  if (value >= 1_000_000) return `\u00A3${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `\u00A3${(value / 1_000).toFixed(0)}k`;
  return `\u00A3${value.toLocaleString()}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Not specified";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const EFFORT_COLORS: Record<string, string> = {
  Low: "#00DCBC",
  Medium: "#F59E0B",
  High: "#EF4444",
};

function renderRecommendedTender(t: ScoredTender, index: number): string {
  const effortColor = EFFORT_COLORS[t.effortEstimate] || "#94A3B8";

  return `
    <tr style="border-bottom: 1px solid #1E293B;">
      <td style="padding: 16px; vertical-align: top;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="background: #00DCBC; color: #000; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 700;">
            #${index + 1} &mdash; ${t.score.total}/100
          </span>
          <span style="background: ${effortColor}22; color: ${effortColor}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
            ${t.effortEstimate} Effort
          </span>
        </div>
        <a href="${t.url}" style="color: #00DCBC; text-decoration: none; font-weight: 600; font-size: 15px; line-height: 1.4;">
          ${t.title}
        </a>
        <div style="background: #1E293B; border-left: 3px solid #00DCBC; padding: 10px 14px; margin: 10px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; color: #E2E8F0; font-size: 13px; line-height: 1.5;">
            ${t.recommendationWhy}
          </p>
        </div>
        <div style="color: #94A3B8; font-size: 12px; margin-top: 8px;">
          <strong>Buyer:</strong> ${t.buyer || "Not specified"} &nbsp;&bull;&nbsp;
          <strong>Value:</strong> ${formatValue(t.value)} &nbsp;&bull;&nbsp;
          <strong>Deadline:</strong> ${formatDate(t.deadlineDate)} &nbsp;&bull;&nbsp;
          <strong>Region:</strong> ${t.region}
        </div>
        <div style="color: #64748B; font-size: 11px; margin-top: 4px;">
          Fit ${t.score.fit}/30 &bull; Value ${t.score.value}/20 &bull; Timeline ${t.score.timeline}/15 &bull; Win ${t.score.winProbability}/20 &bull; Geo ${t.score.geography}/10 &bull; Strategic ${t.score.strategic}/5
        </div>
      </td>
    </tr>`;
}

function buildEmailHtml(result: ScrapeResult): string {
  const { tenders, stats } = result;
  const recommended = tenders
    .filter(
      (t) =>
        !t.excluded &&
        (t.recommendation === "Bid - Strong Fit" ||
          t.recommendation === "Bid - Worth Pursuing")
    )
    .slice(0, 5);

  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let tendersHtml = "";

  if (recommended.length > 0) {
    tendersHtml = `
      <h2 style="color: #00DCBC; font-size: 18px; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #00DCBC;">
        Top Recommendations
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${recommended.map((t, i) => renderRecommendedTender(t, i)).join("")}
      </table>`;

    const remaining =
      stats.afterExclusions - recommended.length;
    if (remaining > 0) {
      tendersHtml += `
        <div style="text-align: center; padding: 16px; color: #94A3B8; font-size: 13px;">
          + ${remaining} more tender${remaining !== 1 ? "s" : ""} in the dashboard
        </div>`;
    }
  } else {
    tendersHtml = `
      <div style="text-align: center; padding: 40px; color: #94A3B8;">
        <p style="font-size: 16px;">No recommended tenders found in the last ${stats.daysSearched} day(s).</p>
        <p style="font-size: 13px;">${stats.afterExclusions} eligible tenders were found but scored below recommendation threshold.</p>
      </div>`;
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #070B14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 680px; margin: 0 auto; background: #0F172A;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #00378E 0%, #280050 100%); padding: 28px 32px;">
      <h1 style="margin: 0; color: #FFFFFF; font-size: 22px; font-weight: 700;">
        UrbanChain Tender Intelligence
      </h1>
      <p style="margin: 6px 0 0 0; color: #00DCBC; font-size: 14px;">${date}</p>
    </div>

    <!-- Stats Bar -->
    <div style="background: #1E293B; padding: 16px 32px; font-size: 13px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color: #94A3B8;">Found: <strong style="color: #FFF;">${stats.totalFound}</strong></td>
          <td style="color: #94A3B8;">Eligible: <strong style="color: #FFF;">${stats.afterExclusions}</strong></td>
          <td style="color: #94A3B8;">Pipeline: <strong style="color: #00DCBC;">${formatValue(stats.pipelineValue)}</strong></td>
          <td style="color: #94A3B8;">High: <strong style="color: #00DCBC;">${stats.highPriority}</strong></td>
        </tr>
      </table>
    </div>

    <!-- Tenders -->
    <div style="padding: 8px 32px 32px 32px;">
      ${tendersHtml}
    </div>

    <!-- Footer -->
    <div style="background: linear-gradient(135deg, #00378E 0%, #280050 100%); padding: 16px 32px; text-align: center;">
      <p style="margin: 0; color: #94A3B8; font-size: 12px;">
        UrbanChain Tender Intelligence &mdash; CPV 09310000 (Electricity Supply)
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendDigestEmail(result: ScrapeResult): Promise<void> {
  const to = process.env.ALERT_EMAIL;
  const from = process.env.FROM_EMAIL || "tenders@urbanchain.energy";

  if (!to) {
    console.warn("ALERT_EMAIL not set — skipping email send");
    return;
  }

  const recommended = result.tenders.filter(
    (t) =>
      !t.excluded &&
      (t.recommendation === "Bid - Strong Fit" ||
        t.recommendation === "Bid - Worth Pursuing")
  );

  const subject =
    recommended.length > 0
      ? `[UC Tenders] ${recommended.length} recommended to bid — ${result.stats.highPriority} high priority`
      : `[UC Tenders] Daily digest — ${result.stats.afterExclusions} eligible tender${result.stats.afterExclusions !== 1 ? "s" : ""}`;

  await getResend().emails.send({
    from,
    to,
    subject,
    html: buildEmailHtml(result),
  });
}
