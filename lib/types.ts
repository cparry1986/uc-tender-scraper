export interface RawTender {
  id: string;
  title: string;
  description: string;
  publishedDate: string;
  deadlineDate: string | null;
  value: number | null;
  currency: string;
  buyer: string;
  location: string;
  source:
    | "find-a-tender"
    | "contracts-finder"
    | "bidstats"
    | "pcs"
    | "sell2wales"
    | "d3-tenders"
    | "the-chest";
  url: string;
  cpvCodes: string[];
  isPipeline?: boolean;
}

export interface ScoreBreakdown {
  fit: number;
  value: number;
  timeline: number;
  winProbability: number;
  geography: number;
  strategic: number;
  total: number;
}

export type Recommendation =
  | "Bid - Strong Fit"
  | "Bid - Worth Pursuing"
  | "Monitor - Watch for Calloffs"
  | "Review - Needs Assessment"
  | "Skip";

export type EffortEstimate = "Low" | "Medium" | "High";

export type Priority = "HIGH" | "MEDIUM" | "LOW" | "SKIP";

export interface ScoredTender extends RawTender {
  score: ScoreBreakdown;
  excluded: boolean;
  exclusionReason: string | null;
  recommendation: Recommendation;
  recommendationWhy: string;
  effortEstimate: EffortEstimate;
  priority: Priority;
  procurementRoute: string;
  buyerType: string;
  region: string;
}

export interface SourceHealth {
  name: string;
  ok: boolean;
  count: number;
}

export interface ScrapeResult {
  tenders: ScoredTender[];
  stats: {
    totalFound: number;
    afterDedup: number;
    afterExclusions: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    skipCount: number;
    pipelineCount: number;
    pipelineValue: number;
    avgScore: number;
    scrapedAt: string;
    daysSearched: number;
  };
  sourceHealth: SourceHealth[];
}

// ── Analytics types ────────────────────────────────────────────────────

export interface RegionData {
  region: string;
  count: number;
  totalValue: number;
}

export interface ProcurementRouteData {
  route: string;
  count: number;
  avgScore: number;
}

export interface ValueBand {
  band: string;
  count: number;
  isSweet: boolean;
}

export interface TimelineEntry {
  week: string;
  count: number;
}

export interface BuyerTypeData {
  type: string;
  count: number;
  totalValue: number;
}

export interface InsightCard {
  text: string;
  type: "positive" | "neutral" | "action";
}

export interface SourceBreakdownData {
  source: string;
  count: number;
}

export interface AnalyticsData {
  regions: RegionData[];
  procurementRoutes: ProcurementRouteData[];
  valueBands: ValueBand[];
  timeline: TimelineEntry[];
  buyerTypes: BuyerTypeData[];
  insights: InsightCard[];
  sourceBreakdown: SourceBreakdownData[];
}

// ── Framework Intelligence types ─────────────────────────────────────

export type FrameworkStatus =
  | "active"
  | "expiring-soon"
  | "re-procuring"
  | "expired"
  | "unknown";

export interface TrackedFramework {
  id: string;
  name: string;
  operator: string;
  reference: string;
  description: string;
  estimatedValue: string;
  currentStatus: FrameworkStatus;
  expiryDate: string | null;
  nextProcurementWindow: string | null;
  relevance: string;
  actionRequired: string;
  ftsSignals: FrameworkSignal[];
  tier: "critical" | "high" | "medium";
}

export interface FrameworkSignal {
  title: string;
  url: string;
  date: string;
  type: "re-procurement" | "market-engagement" | "award" | "expiry-notice" | "pipeline";
}

export interface ContractExpiry {
  id: string;
  title: string;
  buyer: string;
  value: number | null;
  awardDate: string;
  expiryDate: string | null;
  estimatedExpiryDate: string | null;
  region: string;
  source: string;
  url: string;
  daysUntilExpiry: number | null;
}

export interface FrameworkIntelligence {
  frameworks: TrackedFramework[];
  contractExpiries: ContractExpiry[];
  upcomingReprocurements: number;
  expiringNext6Months: number;
  totalFrameworkValue: string;
}
