import { RawTender, ScoreBreakdown, ScoredTender } from "./types";

// ── Hard Exclusions ────────────────────────────────────────────────────

const EXCLUSION_PATTERNS = [
  /solar\s+(panel|install|farm|pv)/i,
  /heat\s+network/i,
  /ev\s+charg/i,
  /electric\s+vehicle\s+charg/i,
  /consultancy/i,
  /energy\s+audit/i,
  /metering\s+service/i,
  /smart\s+meter\s+install/i,
  /retrofit/i,
  /insulation/i,
  /electrical\s+works/i,
  /electrical\s+install/i,
  /street\s+light/i,
  /generation\s+(plant|facility|asset)/i,
  /power\s+generation/i,
];

function checkExclusion(t: RawTender): string | null {
  const text = `${t.title} ${t.description}`.toLowerCase();
  for (const pattern of EXCLUSION_PATTERNS) {
    if (pattern.test(text)) {
      return `Excluded: matches "${pattern.source}"`;
    }
  }
  return null;
}

// ── Value Score (0-30) ─────────────────────────────────────────────────

function scoreValue(value: number | null): number {
  if (value === null || value === 0) return 10; // Unknown — moderate default
  if (value >= 500_000 && value <= 2_000_000) return 30; // Sweet spot
  if (value >= 250_000 && value < 500_000) return 22;
  if (value > 2_000_000 && value <= 5_000_000) return 20;
  if (value >= 100_000 && value < 250_000) return 15;
  if (value > 5_000_000 && value <= 10_000_000) return 12;
  if (value < 100_000) return 5;
  return 8; // Very large contracts (>£10m)
}

// ── Timeline Score (0-20) ──────────────────────────────────────────────

function scoreTimeline(deadline: string | null): number {
  if (!deadline) return 10; // Unknown deadline — moderate default
  const now = new Date();
  const dl = new Date(deadline);
  const daysLeft = Math.ceil(
    (dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft < 0) return 0; // Already passed
  if (daysLeft <= 3) return 5; // Too tight
  if (daysLeft <= 7) return 12;
  if (daysLeft <= 14) return 18;
  if (daysLeft <= 30) return 20; // Ideal window
  if (daysLeft <= 60) return 15;
  return 10; // Very far out
}

// ── Keyword Score (0-30) ───────────────────────────────────────────────

const POSITIVE_KEYWORDS: [RegExp, number][] = [
  [/supply\s+of\s+electricity/i, 10],
  [/electricity\s+supply/i, 8],
  [/power\s+purchase\s+agreement|ppa/i, 8],
  [/rego\b/i, 7],
  [/renewable\s+energy\s+guarantee/i, 7],
  [/flexible\s+(supply|procurement|contract)/i, 6],
  [/licensed\s+(electricity\s+)?supplier/i, 8],
  [/half[- ]?hourly/i, 5],
  [/hhd|hh\s+data/i, 4],
  [/green\s+(energy|electricity|tariff)/i, 5],
  [/renewable\s+(electricity|energy|supply)/i, 5],
  [/framework\s+agreement/i, 3],
  [/cpv.*09310/i, 5],
];

function scoreKeywords(t: RawTender): number {
  const text = `${t.title} ${t.description}`;
  let score = 0;
  for (const [pattern, points] of POSITIVE_KEYWORDS) {
    if (pattern.test(text)) {
      score += points;
    }
  }
  // CPV code direct match
  if (t.cpvCodes.some((c) => c.startsWith("09310"))) {
    score += 5;
  }
  return Math.min(score, 30);
}

// ── Geography Score (0-20) ─────────────────────────────────────────────

const NW_ENGLAND_PATTERNS = [
  /north\s*west/i,
  /manchester/i,
  /liverpool/i,
  /lancashire/i,
  /cheshire/i,
  /cumbria/i,
  /merseyside/i,
  /greater\s+manchester/i,
  /salford/i,
  /bolton/i,
  /wigan/i,
  /warrington/i,
  /preston/i,
  /blackburn/i,
  /blackpool/i,
];

function scoreGeography(t: RawTender): number {
  const text = `${t.location} ${t.buyer} ${t.description}`;
  // NW England boost
  for (const pattern of NW_ENGLAND_PATTERNS) {
    if (pattern.test(text)) return 20;
  }
  // UK-wide or unspecified
  if (/national|uk[- ]wide|england/i.test(text)) return 12;
  // Other named UK region
  if (
    /london|south|east|midlands|yorkshire|scotland|wales|ireland/i.test(text)
  ) {
    return 8;
  }
  return 10; // Unknown — moderate default
}

// ── Public API ─────────────────────────────────────────────────────────

export function scoreTender(t: RawTender): ScoredTender {
  const exclusionReason = checkExclusion(t);

  const breakdown: ScoreBreakdown = {
    value: scoreValue(t.value),
    timeline: scoreTimeline(t.deadlineDate),
    keywords: scoreKeywords(t),
    geography: scoreGeography(t),
    total: 0,
  };
  breakdown.total =
    breakdown.value + breakdown.timeline + breakdown.keywords + breakdown.geography;

  return {
    ...t,
    score: breakdown,
    excluded: exclusionReason !== null,
    exclusionReason,
  };
}

export function scoreTenders(tenders: RawTender[]): ScoredTender[] {
  return tenders
    .map(scoreTender)
    .sort((a, b) => b.score.total - a.score.total);
}
