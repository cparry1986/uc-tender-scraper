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
  source: "find-a-tender" | "contracts-finder";
  url: string;
  cpvCodes: string[];
}

export interface ScoreBreakdown {
  value: number;
  timeline: number;
  keywords: number;
  geography: number;
  total: number;
}

export interface ScoredTender extends RawTender {
  score: ScoreBreakdown;
  excluded: boolean;
  exclusionReason: string | null;
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
    scrapedAt: string;
    daysSearched: number;
  };
}
