import {
  ScoredTender,
  AnalyticsData,
  RegionData,
  ProcurementRouteData,
  ValueBand,
  TimelineEntry,
  BuyerTypeData,
  InsightCard,
  SourceBreakdownData,
} from "./types";

function formatVal(v: number): string {
  if (v >= 1_000_000) return `\u00A3${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `\u00A3${(v / 1_000).toFixed(0)}k`;
  return `\u00A3${v}`;
}

// ── Geographic breakdown ───────────────────────────────────────────────

function computeRegions(tenders: ScoredTender[]): RegionData[] {
  const map = new Map<string, { count: number; totalValue: number }>();
  for (const t of tenders) {
    const r = t.region || "Not Specified";
    const existing = map.get(r) || { count: 0, totalValue: 0 };
    existing.count++;
    existing.totalValue += t.value || 0;
    map.set(r, existing);
  }
  return Array.from(map.entries())
    .map(([region, data]) => ({ region, ...data }))
    .sort((a, b) => b.count - a.count);
}

// ── Procurement route breakdown ────────────────────────────────────────

function computeProcurementRoutes(
  tenders: ScoredTender[]
): ProcurementRouteData[] {
  const map = new Map<string, { count: number; totalScore: number }>();
  for (const t of tenders) {
    const r = t.procurementRoute;
    const existing = map.get(r) || { count: 0, totalScore: 0 };
    existing.count++;
    existing.totalScore += t.score.total;
    map.set(r, existing);
  }
  return Array.from(map.entries())
    .map(([route, data]) => ({
      route,
      count: data.count,
      avgScore: Math.round(data.totalScore / data.count),
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Value distribution ─────────────────────────────────────────────────

function computeValueBands(tenders: ScoredTender[]): ValueBand[] {
  const bands: { label: string; min: number; max: number; sweet: boolean }[] = [
    { label: "Under \u00A3100k", min: 0, max: 100_000, sweet: false },
    { label: "\u00A3100k-500k", min: 100_000, max: 500_000, sweet: false },
    { label: "\u00A3500k-2m", min: 500_000, max: 2_000_000, sweet: true },
    { label: "\u00A32m-5m", min: 2_000_000, max: 5_000_000, sweet: true },
    { label: "\u00A35m+", min: 5_000_000, max: Infinity, sweet: false },
    { label: "Undisclosed", min: -1, max: -1, sweet: false },
  ];

  return bands.map((band) => ({
    band: band.label,
    count: tenders.filter((t) => {
      if (band.min === -1) return !t.value;
      return t.value !== null && t.value >= band.min && t.value < band.max;
    }).length,
    isSweet: band.sweet,
  }));
}

// ── Timeline view (deadlines grouped by week) ──────────────────────────

function computeTimeline(tenders: ScoredTender[]): TimelineEntry[] {
  const now = new Date();
  const entries: TimelineEntry[] = [];

  // First 4 weeks: weekly
  for (let i = 0; i < 4; i++) {
    const start = new Date(now);
    start.setDate(now.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const label =
      i === 0 ? "This week" : i === 1 ? "Next week" : `Week ${i + 1}`;

    const count = tenders.filter((t) => {
      if (!t.deadlineDate) return false;
      const dl = new Date(t.deadlineDate);
      return dl >= start && dl < end;
    }).length;
    entries.push({ week: label, count });
  }

  // Then monthly buckets for the next 18 months
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  for (let m = 1; m <= 18; m++) {
    const start = new Date(now);
    start.setMonth(now.getMonth() + m, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(start.getMonth() + 1);

    const label = `${monthNames[start.getMonth()]} ${start.getFullYear()}`;

    const count = tenders.filter((t) => {
      if (!t.deadlineDate) return false;
      const dl = new Date(t.deadlineDate);
      return dl >= start && dl < end;
    }).length;

    if (count > 0 || m <= 6) {
      entries.push({ week: label, count });
    }
  }

  return entries;
}

// ── Buyer type analysis ────────────────────────────────────────────────

function computeBuyerTypes(tenders: ScoredTender[]): BuyerTypeData[] {
  const map = new Map<string, { count: number; totalValue: number }>();
  for (const t of tenders) {
    const bt = t.buyerType;
    const existing = map.get(bt) || { count: 0, totalValue: 0 };
    existing.count++;
    existing.totalValue += t.value || 0;
    map.set(bt, existing);
  }
  return Array.from(map.entries())
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

// ── Auto-generated insight cards ───────────────────────────────────────

function generateInsights(
  tenders: ScoredTender[],
  regions: RegionData[],
  buyerTypes: BuyerTypeData[]
): InsightCard[] {
  const insights: InsightCard[] = [];
  const total = tenders.length;
  if (total === 0) return insights;

  // Top region insight
  if (regions.length > 0) {
    const top = regions[0];
    const pct = Math.round((top.count / total) * 100);
    insights.push({
      text: `${pct}% of current opportunities are in ${top.region}${top.region === "North West" ? " — your strongest region" : ""}`,
      type: top.region === "North West" ? "positive" : "neutral",
    });
  }

  // Framework calloffs closing soon
  const calloffs = tenders.filter(
    (t) =>
      !t.excluded &&
      (t.procurementRoute === "Framework Call-off" ||
        t.procurementRoute === "Further Competition" ||
        t.procurementRoute === "Direct Award") &&
      t.deadlineDate
  );
  const closingSoon = calloffs.filter((t) => {
    const dl = new Date(t.deadlineDate!);
    const daysLeft = Math.ceil(
      (dl.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysLeft > 0 && daysLeft <= 14;
  });
  if (closingSoon.length > 0) {
    insights.push({
      text: `${closingSoon.length} framework call-off${closingSoon.length > 1 ? "s" : ""} closing in the next 14 days — low effort, high win probability`,
      type: "action",
    });
  }

  // High-value buyer type
  if (buyerTypes.length > 0) {
    const topBuyer = buyerTypes[0];
    if (topBuyer.totalValue > 0) {
      insights.push({
        text: `${topBuyer.type}${topBuyer.type.endsWith("s") ? "" : "s"} represent ${formatVal(topBuyer.totalValue)} in pipeline value`,
        type: "neutral",
      });
    }
  }

  // Sweet spot tenders
  const sweetSpot = tenders.filter(
    (t) =>
      !t.excluded &&
      t.value !== null &&
      t.value >= 500_000 &&
      t.value <= 5_000_000
  );
  if (sweetSpot.length > 0) {
    insights.push({
      text: `${sweetSpot.length} tender${sweetSpot.length > 1 ? "s" : ""} in the \u00A3500k-\u00A35m sweet spot — highest ROI for bid effort`,
      type: "positive",
    });
  }

  // High priority count
  const highPriority = tenders.filter((t) => t.priority === "HIGH");
  if (highPriority.length > 0) {
    insights.push({
      text: `${highPriority.length} high-priority opportunity${highPriority.length > 1 ? "ies" : "y"} recommended for immediate bid action`,
      type: "action",
    });
  }

  return insights.slice(0, 4);
}

// ── Source breakdown ──────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  "find-a-tender": "Find a Tender",
  "contracts-finder": "Contracts Finder",
  bidstats: "Bidstats",
  pcs: "PCS (Scotland)",
  sell2wales: "Sell2Wales",
  "d3-tenders": "D3 Tenders",
  "the-chest": "The Chest (NW)",
  etendersni: "eTendersNI",
  delta: "Delta eSourcing",
  "due-north": "Due North Portals",
};

function computeSourceBreakdown(tenders: ScoredTender[]): SourceBreakdownData[] {
  const map = new Map<string, number>();
  for (const t of tenders) {
    const label = SOURCE_LABELS[t.source] || t.source;
    map.set(label, (map.get(label) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Public API ─────────────────────────────────────────────────────────

export function computeAnalytics(tenders: ScoredTender[]): AnalyticsData {
  const eligible = tenders.filter((t) => !t.excluded);
  const regions = computeRegions(eligible);
  const procurementRoutes = computeProcurementRoutes(eligible);
  const valueBands = computeValueBands(eligible);
  const timeline = computeTimeline(eligible);
  const buyerTypes = computeBuyerTypes(eligible);
  const insights = generateInsights(eligible, regions, buyerTypes);
  const sourceBreakdown = computeSourceBreakdown(tenders);

  return {
    regions,
    procurementRoutes,
    valueBands,
    timeline,
    buyerTypes,
    insights,
    sourceBreakdown,
  };
}
