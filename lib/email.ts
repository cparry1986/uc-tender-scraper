import { Resend } from "resend";
import { ScoredTender, ScrapeResult } from "./types";

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

function priorityLabel(score: number): string {
  if (score >= 65) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function priorityColor(score: number): string {
  if (score >= 65) return "#00DCBC";
  if (score >= 40) return "#F59E0B";
  return "#6B7280";
}

function formatValue(value: number | null): string {
  if (!value) return "Not disclosed";
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(0)}k`;
  return `£${value.toLocaleString()}`;
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

function renderTenderRow(t: ScoredTender): string {
  const priority = priorityLabel(t.score.total);
  const color = priorityColor(t.score.total);

  return `
    <tr style="border-bottom: 1px solid #1E293B;">
      <td style="padding: 16px; vertical-align: top;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="background: ${color}; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">
            ${priority} (${t.score.total})
          </span>
          <span style="color: #94A3B8; font-size: 12px;">${t.source === "find-a-tender" ? "Find a Tender" : "Contracts Finder"}</span>
        </div>
        <a href="${t.url}" style="color: #00DCBC; text-decoration: none; font-weight: 600; font-size: 15px;">
          ${t.title}
        </a>
        <div style="color: #94A3B8; font-size: 13px; margin-top: 6px;">
          <strong>Buyer:</strong> ${t.buyer || "Not specified"} &nbsp;|&nbsp;
          <strong>Value:</strong> ${formatValue(t.value)} &nbsp;|&nbsp;
          <strong>Deadline:</strong> ${formatDate(t.deadlineDate)}
        </div>
        <div style="color: #64748B; font-size: 12px; margin-top: 4px;">
          Score: Value ${t.score.value} | Timeline ${t.score.timeline} | Keywords ${t.score.keywords} | Geography ${t.score.geography}
        </div>
      </td>
    </tr>`;
}

function buildEmailHtml(result: ScrapeResult): string {
  const { tenders, stats } = result;
  const eligible = tenders.filter((t) => !t.excluded);
  const high = eligible.filter((t) => t.score.total >= 65);
  const medium = eligible.filter(
    (t) => t.score.total >= 40 && t.score.total < 65
  );
  const low = eligible.filter((t) => t.score.total < 40);

  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let tendersHtml = "";

  if (high.length > 0) {
    tendersHtml += `
      <h2 style="color: #00DCBC; font-size: 18px; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #00DCBC;">
        High Priority (${high.length})
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${high.map(renderTenderRow).join("")}
      </table>`;
  }

  if (medium.length > 0) {
    tendersHtml += `
      <h2 style="color: #F59E0B; font-size: 18px; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #F59E0B;">
        Medium Priority (${medium.length})
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${medium.map(renderTenderRow).join("")}
      </table>`;
  }

  if (low.length > 0) {
    tendersHtml += `
      <h2 style="color: #6B7280; font-size: 18px; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #6B7280;">
        Lower Priority (${low.length})
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${low.map(renderTenderRow).join("")}
      </table>`;
  }

  if (eligible.length === 0) {
    tendersHtml = `
      <div style="text-align: center; padding: 40px; color: #94A3B8;">
        <p style="font-size: 16px;">No matching electricity tenders found in the last ${stats.daysSearched} day(s).</p>
      </div>`;
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #0B1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 680px; margin: 0 auto; background: #0F172A;">
    <!-- Header -->
    <div style="background: #00378E; padding: 24px 32px;">
      <h1 style="margin: 0; color: #FFFFFF; font-size: 22px; font-weight: 700;">
        UrbanChain Tender Digest
      </h1>
      <p style="margin: 6px 0 0 0; color: #00DCBC; font-size: 14px;">${date}</p>
    </div>

    <!-- Stats Bar -->
    <div style="background: #1E293B; padding: 16px 32px; display: flex; gap: 24px; font-size: 13px;">
      <span style="color: #94A3B8;">Found: <strong style="color: #FFFFFF;">${stats.totalFound}</strong></span>
      <span style="color: #94A3B8;">Eligible: <strong style="color: #FFFFFF;">${stats.afterExclusions}</strong></span>
      <span style="color: #94A3B8;">High: <strong style="color: #00DCBC;">${stats.highPriority}</strong></span>
      <span style="color: #94A3B8;">Medium: <strong style="color: #F59E0B;">${stats.mediumPriority}</strong></span>
    </div>

    <!-- Tenders -->
    <div style="padding: 8px 32px 32px 32px;">
      ${tendersHtml}
    </div>

    <!-- Footer -->
    <div style="background: #00378E; padding: 16px 32px; text-align: center;">
      <p style="margin: 0; color: #94A3B8; font-size: 12px;">
        UrbanChain Tender Scraper &mdash; CPV 09310000 (Electricity)
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

  const eligible = result.tenders.filter((t) => !t.excluded);
  const high = eligible.filter((t) => t.score.total >= 65).length;

  const subject = high > 0
    ? `[UC Tenders] ${high} high-priority tender${high > 1 ? "s" : ""} found`
    : `[UC Tenders] Daily digest — ${eligible.length} tender${eligible.length !== 1 ? "s" : ""} found`;

  await getResend().emails.send({
    from,
    to,
    subject,
    html: buildEmailHtml(result),
  });
}
