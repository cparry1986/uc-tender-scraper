import {
  RawTender,
  ScoreBreakdown,
  ScoredTender,
  Recommendation,
  EffortEstimate,
  Priority,
} from "./types";

// ── Relevance Gate ─────────────────────────────────────────────────────

const SUPPLY_KEYWORDS = [
  /electricity\s+supply/i,
  /energy\s+supply/i,
  /supply\s+of\s+electricity/i,
  /supply\s+of\s+energy/i,
  /electricity\s+framework/i,
  /power\s+purchase/i,
  /\bPPA\b/,
  /\bCPPA\b/,
  /half[\s-]?hourly/i,
  /\bHH\s+supply/i,
  /renewable\s+energy\s+supply/i,
  /green\s+energy/i,
  /\bREGO\b/,
  /utility\s+supply/i,
  /gas\s+and\s+electricity/i,
  /electricity\s+and\s+gas/i,
  /supply\s+of\s+gas\s+and\s+electricity/i,
  /supply\s+of\s+utilities/i,
  /licensed\s+supplier/i,
  /flexible\s+purchas/i,
  /flexible\s+procurement\s+and\s+supply/i,
  /electricity\s+procurement/i,
  /energy\s+procurement/i,
  /renewable\s+supply/i,
  /green\s+tariff/i,
  /energy\s+framework/i,
  /electricity\s+contract/i,
  /energy\s+contract/i,
  /electricity\s+tender/i,
  /energy\s+tender/i,
  /public\s+buying\s+organisation/i,
  /\bPBO\b/,
  /electricity\s+portfolio/i,
];

function passesRelevanceGate(text: string): boolean {
  return SUPPLY_KEYWORDS.some((kw) => kw.test(text));
}

// ── Hard Exclusions ────────────────────────────────────────────────────

const EXCLUSION_PATTERNS: [RegExp, string][] = [
  [/solar\s+(panel|install|farm|pv)/i, "Solar installation"],
  [/heat\s+network/i, "Heat networks"],
  [/ev\s+charg/i, "EV charging"],
  [/electric\s+vehicle\s+charg/i, "EV charging"],
  [/consultancy/i, "Consultancy"],
  [/energy\s+audit/i, "Energy audit"],
  [/metering\s+(service|install)/i, "Metering"],
  [/smart\s+meter/i, "Smart metering"],
  [/\bretrofit\b/i, "Retrofit"],
  [/\binsulation\b/i, "Insulation"],
  [/electrical\s+(works|install)/i, "Electrical works"],
  [/street\s+light/i, "Street lighting"],
  [/(power\s+)?generation\s+(plant|facility|asset)/i, "Generation"],
  [/traffic\s+management/i, "Traffic management"],
  [/\bCCTV\b/i, "CCTV"],
  [/\bgritting\b/i, "Gritting"],
  [/\bhighways?\b/i, "Highways"],
  [/\bconstruction\b/i, "Construction"],
  [/\bdemolition\b/i, "Demolition"],
  [/\bcleaning\s+(service|contract)/i, "Cleaning"],
  [/\bcatering\b/i, "Catering"],
  [/waste\s+(collection|management|disposal)/i, "Waste management"],
  [/water\s+supply/i, "Water supply"],
  [/\btelecoms?\b/i, "Telecoms"],
  [/\bIT\s+services?\b/, "IT services"],
  [/\bprinting\b/i, "Printing"],
  [/\bfurniture\b/i, "Furniture"],
  [/\bvehicles?\b/i, "Vehicles"],
  [/spill\s+response/i, "Spill response"],
  [/\bflood\b/i, "Flood"],
  [/\bdrainage\b/i, "Drainage"],
  [/\broad\s+(surface|maintenance|marking)/i, "Roads"],
  [/\bsignage\b/i, "Signage"],
  [/\bparking\b/i, "Parking"],
  [/security\s+(guard|service|patrol)/i, "Security"],
  [/\bHVAC\b/i, "HVAC"],
  [/\bplumbing\b/i, "Plumbing"],
  [/\broofing\b/i, "Roofing"],
  [/\bscaffolding\b/i, "Scaffolding"],
  [/\basbestos\b/i, "Asbestos"],
  [/pest\s+control/i, "Pest control"],
  [/\blandscaping\b/i, "Landscaping"],
  [/\bpostal\b/i, "Postal"],
  [/\bcourier\b/i, "Courier"],
  [/training\s+(service|provision|course)/i, "Training"],
  [/\brecruitment\b/i, "Recruitment"],
  [/legal\s+services?/i, "Legal services"],
  [/\btranslation\b/i, "Translation"],
  [/\badvertising\b/i, "Advertising"],
  [/media\s+buying/i, "Media buying"],
];

function checkExclusion(text: string): string | null {
  for (const [pattern, label] of EXCLUSION_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

// ── Procurement Route Detection ────────────────────────────────────────

export function detectProcurementRoute(text: string): string {
  const t = text.toLowerCase();
  if (/direct\s+award/.test(t)) return "Direct Award";
  if (/call[\s-]?off/.test(t)) return "Framework Call-off";
  if (/further\s+competition/.test(t)) return "Further Competition";
  if (/mini[\s-]?competition/.test(t)) return "Mini Competition";
  if (/dynamic\s+purchas/i.test(t) || /\bDPS\b/.test(text)) return "DPS";
  if (/open\s+(tender|procedure)/.test(t)) return "Open Tender";
  if (/restricted\s+(tender|procedure)/.test(t)) return "Restricted";
  if (/competitive\s+dialogue/.test(t)) return "Competitive Dialogue";
  if (/framework/.test(t)) return "Framework";
  return "Not Specified";
}

// ── Buyer Type Detection ───────────────────────────────────────────────

export function detectBuyerType(buyer: string, text: string): string {
  const combined = `${buyer} ${text}`.toLowerCase();
  if (/nhs|health|hospital|clinical|commissioning\s+group|medical/.test(combined))
    return "NHS Trust";
  if (/universit|college/.test(combined)) return "University";
  if (/council|borough|county|city\s+of|district|metropolitan/.test(combined))
    return "Local Authority";
  if (/housing|homes\s+(association|group)|habitation/.test(combined))
    return "Housing Association";
  if (/police|fire|ambulance|emergency\s+service/.test(combined))
    return "Emergency Services";
  if (/\bmod\b|ministry\s+of\s+defence|defence\b/.test(combined)) return "MOD";
  if (/school|academy|education|learning/.test(combined)) return "Education";
  return "Other Public Sector";
}

// ── Region Detection ───────────────────────────────────────────────────

export function detectRegion(
  location: string,
  buyer: string,
  description: string
): string {
  const text = `${location} ${buyer} ${description}`.toLowerCase();

  if (
    /north\s*west|manchester|lancashire|liverpool|cheshire|cumbria|merseyside|greater\s+manchester|warrington|bolton|salford|stockport|wigan|oldham|rochdale|bury|tameside|trafford|preston|blackburn|blackpool/.test(
      text
    )
  )
    return "North West";
  if (
    /north\s*east|newcastle|durham|sunderland|tyne|tees|yorkshire|leeds|sheffield|bradford|hull|\byork\b/.test(
      text
    )
  )
    return "North East / Yorkshire";
  if (
    /birmingham|nottingham|leicester|derby|coventry|wolverhampton|stoke|midlands/.test(
      text
    )
  )
    return "Midlands";
  if (
    /\blondon\b|westminster|camden|hackney|tower\s+hamlets|islington|southwark|lambeth/.test(
      text
    )
  )
    return "London";
  if (
    /south\s*east|kent|surrey|sussex|hampshire|berkshire|oxford|brighton/.test(
      text
    )
  )
    return "South East";
  if (
    /south\s*west|bristol|bath|devon|cornwall|somerset|dorset|gloucester|wiltshire/.test(
      text
    )
  )
    return "South West";
  if (
    /east\s+(anglia|of\s+england)|norfolk|suffolk|cambridge|essex|hertford|bedford/.test(
      text
    )
  )
    return "East of England";
  if (/scotland|scottish|edinburgh|glasgow|aberdeen|dundee/.test(text))
    return "Scotland";
  if (/wales|welsh|cardiff|swansea|newport/.test(text)) return "Wales";
  if (/northern\s+ireland|belfast/.test(text)) return "Northern Ireland";
  if (/national|uk[\s-]?wide|across\s+the\s+uk|england\s+wide/.test(text))
    return "National";

  return "Not Specified";
}

// ── Fit Score (0-30) ───────────────────────────────────────────────────

const FIT_KEYWORDS: [RegExp, number][] = [
  [/supply\s+of\s+electricity/i, 6],
  [/electricity\s+supply/i, 5],
  [/half[\s-]?hourly/i, 5],
  [/\bHH\s+(supply|data|meter)/i, 5],
  [/renewable\s+(energy|electricity)/i, 4],
  [/\bPPA\b|power\s+purchase\s+agreement/i, 5],
  [/\bREGO\b|renewable\s+energy\s+guarantee/i, 5],
  [/flexible\s+(purchas|supply|contract)/i, 4],
  [/green\s+tariff/i, 4],
  [/green\s+energy/i, 3],
  [/corporate\s+PPA|CPPA/i, 5],
  [/sleeved\s+PPA/i, 5],
  [/renewable\s+matching/i, 4],
  [/carbon\s+neutral/i, 3],
  [/net[\s-]?zero/i, 3],
  [/licensed\s+(electricity\s+)?supplier/i, 5],
];

function scoreFit(text: string, cpvCodes: string[]): number {
  let score = 0;
  for (const [pattern, points] of FIT_KEYWORDS) {
    if (pattern.test(text)) score += points;
  }
  // CPV code matching - expanded set
  if (cpvCodes.some((c) => c.startsWith("09310"))) score += 4; // Electricity
  else if (cpvCodes.some((c) => c.startsWith("09300"))) score += 3; // Electricity, heating, solar, nuclear
  else if (cpvCodes.some((c) => c.startsWith("65310"))) score += 3; // Electricity distribution
  else if (cpvCodes.some((c) => c.startsWith("31682"))) score += 2; // Electricity supplies
  else if (cpvCodes.some((c) => c.startsWith("65000"))) score += 2; // Public utilities
  else if (cpvCodes.some((c) => c.startsWith("09121"))) score += 2; // Coal, lignite, peat, and other
  return Math.min(score, 30);
}

// ── Value Score (0-20) ─────────────────────────────────────────────────

function scoreValue(value: number | null): number {
  if (value === null || value === 0) return 8;
  if (value < 50_000) return 2;
  if (value < 100_000) return 5;
  if (value < 200_000) return 8;
  if (value < 500_000) return 14;
  if (value <= 2_000_000) return 20;
  if (value <= 5_000_000) return 14;
  if (value <= 10_000_000) return 8;
  if (value <= 20_000_000) return 5;
  return 2;
}

// ── Timeline Score (0-15) ──────────────────────────────────────────────

function scoreTimeline(deadline: string | null): number {
  if (!deadline) return 7;
  const now = new Date();
  const dl = new Date(deadline);
  const daysLeft = Math.ceil(
    (dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysLeft < 0) return 0;
  if (daysLeft < 3) return 2;
  if (daysLeft <= 7) return 8;
  if (daysLeft <= 14) return 12;
  if (daysLeft <= 45) return 15;
  if (daysLeft <= 90) return 10;
  return 5;
}

// ── Win Probability (0-20) ─────────────────────────────────────────────

function scoreWinProbability(text: string, procurementRoute: string): number {
  let base: number;
  switch (procurementRoute) {
    case "Direct Award":
      base = 18;
      break;
    case "Framework Call-off":
    case "Further Competition":
      base = 16;
      break;
    case "Mini Competition":
      base = 13;
      break;
    case "DPS":
      base = 12;
      break;
    case "Framework":
      base = 11;
      break;
    case "Open Tender":
      base = 8;
      break;
    case "Restricted":
      base = 6;
      break;
    case "Competitive Dialogue":
      base = 5;
      break;
    default:
      base = 10;
  }

  if (/\bSME\b|sme[\s-]?friendly/i.test(text)) base += 2;
  if (/social\s+value/i.test(text)) base += 1;
  if (/local\s+supplier/i.test(text)) base += 1;

  return Math.min(base, 20);
}

// ── Geography Score (0-10) ─────────────────────────────────────────────

function scoreGeography(region: string): number {
  switch (region) {
    case "North West":
      return 10;
    case "North East / Yorkshire":
      return 7;
    case "Midlands":
      return 5;
    case "National":
      return 4;
    case "London":
    case "South East":
    case "South West":
    case "East of England":
      return 3;
    case "Scotland":
    case "Wales":
      return 2;
    case "Northern Ireland":
      return 2;
    default:
      return 4;
  }
}

// ── Strategic Score (0-5) ──────────────────────────────────────────────

function scoreStrategic(buyerType: string): number {
  switch (buyerType) {
    case "NHS Trust":
    case "University":
      return 5;
    case "Local Authority":
    case "Housing Association":
    case "Emergency Services":
    case "MOD":
      return 4;
    case "Education":
      return 3;
    default:
      return 1;
  }
}

// ── Effort Estimation ──────────────────────────────────────────────────

function estimateEffort(procurementRoute: string): EffortEstimate {
  switch (procurementRoute) {
    case "Direct Award":
    case "Framework Call-off":
      return "Low";
    case "Further Competition":
    case "Mini Competition":
    case "DPS":
    case "Framework":
      return "Medium";
    case "Open Tender":
    case "Restricted":
    case "Competitive Dialogue":
      return "High";
    default:
      return "Medium";
  }
}

// ── Recommendation Generator ───────────────────────────────────────────

function formatVal(v: number | null): string {
  if (!v) return "undisclosed value";
  if (v >= 1_000_000) return `\u00A3${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `\u00A3${(v / 1_000).toFixed(0)}k`;
  return `\u00A3${v}`;
}

function generateRecommendation(
  t: RawTender,
  score: ScoreBreakdown,
  excluded: boolean,
  exclusionReason: string | null,
  procurementRoute: string,
  buyerType: string,
  region: string
): { recommendation: Recommendation; why: string } {
  if (excluded) {
    return {
      recommendation: "Skip",
      why: `Skip: Contract is for ${exclusionReason?.toLowerCase() || "non-supply services"}, not electricity supply`,
    };
  }

  const total = score.total;
  const buyerStr = t.buyer || "Unknown buyer";
  const valStr = formatVal(t.value);
  const isLargeFramework =
    (t.value !== null && t.value > 10_000_000) ||
    /framework/i.test(`${t.title} ${t.description}`);

  if (total >= 70) {
    const strengths: string[] = [];
    if (score.fit >= 20)
      strengths.push("strong match for HH electricity supply");
    else if (score.fit >= 12) strengths.push("good electricity supply fit");
    if (score.value >= 16 && t.value)
      strengths.push(`${valStr} value sits in our sweet spot`);
    if (score.winProbability >= 15)
      strengths.push(
        `${procurementRoute.toLowerCase()} route means lower competition`
      );
    if (score.geography >= 8) strengths.push(`${region} geographic fit`);
    if (score.strategic >= 4)
      strengths.push(`${buyerType} is a strong reference customer`);

    const detail =
      strengths.length > 0
        ? strengths.slice(0, 3).join(", ")
        : "high overall match across dimensions";

    return {
      recommendation: "Bid - Strong Fit",
      why: `Strong fit: ${detail} for ${buyerStr}`,
    };
  }

  if (total >= 50) {
    const highlights: string[] = [];
    if (buyerType !== "Other Public Sector")
      highlights.push(`${buyerType} in ${region}`);
    if (t.value) highlights.push(`${valStr} contract`);
    if (score.fit >= 12) highlights.push("relevant supply keywords");

    const detail =
      highlights.length > 0
        ? highlights.slice(0, 2).join(", ")
        : `moderate fit across dimensions for ${buyerStr}`;

    return {
      recommendation: "Bid - Worth Pursuing",
      why: `Worth pursuing: ${detail} — review requirements and assess capacity to bid`,
    };
  }

  if (total >= 30 && isLargeFramework) {
    return {
      recommendation: "Monitor - Watch for Calloffs",
      why: `Monitor: Large framework worth ${valStr} — too large to win outright but watch for regional call-off lots from ${buyerStr}`,
    };
  }

  if (total >= 30) {
    return {
      recommendation: "Review - Needs Assessment",
      why: `Review: ${buyerStr} ${valStr} opportunity scores moderately — needs manual review of full tender documents to assess fit`,
    };
  }

  return {
    recommendation: "Skip",
    why: `Skip: Low overall match (${total}/100) — ${score.fit < 8 ? "weak keyword relevance" : "poor fit"} for UrbanChain's supply model`,
  };
}

// ── Priority ───────────────────────────────────────────────────────────

function getPriority(total: number, excluded: boolean): Priority {
  if (excluded) return "SKIP";
  if (total >= 70) return "HIGH";
  if (total >= 50) return "MEDIUM";
  if (total >= 30) return "LOW";
  return "SKIP";
}

// ── Public API ─────────────────────────────────────────────────────────

export function scoreTender(t: RawTender): ScoredTender {
  const text = `${t.title} ${t.description}`;

  // Relevance gate
  const relevant = passesRelevanceGate(text);

  // Exclusion check
  const exclusionMatch = checkExclusion(text);
  const excluded = !relevant || exclusionMatch !== null;
  const exclusionReason = !relevant
    ? "No supply keywords found"
    : exclusionMatch;

  // Detect metadata
  const procurementRoute = detectProcurementRoute(text);
  const buyerType = detectBuyerType(t.buyer, t.description);
  const region = detectRegion(t.location, t.buyer, t.description);

  // Score dimensions
  const breakdown: ScoreBreakdown = {
    fit: excluded ? 0 : scoreFit(text, t.cpvCodes),
    value: excluded ? 0 : scoreValue(t.value),
    timeline: excluded ? 0 : scoreTimeline(t.deadlineDate),
    winProbability: excluded
      ? 0
      : scoreWinProbability(text, procurementRoute),
    geography: excluded ? 0 : scoreGeography(region),
    strategic: excluded ? 0 : scoreStrategic(buyerType),
    total: 0,
  };
  breakdown.total =
    breakdown.fit +
    breakdown.value +
    breakdown.timeline +
    breakdown.winProbability +
    breakdown.geography +
    breakdown.strategic;

  const priority = getPriority(breakdown.total, excluded);
  const { recommendation, why } = generateRecommendation(
    t,
    breakdown,
    excluded,
    exclusionReason,
    procurementRoute,
    buyerType,
    region
  );
  const effortEstimate = estimateEffort(procurementRoute);

  return {
    ...t,
    score: breakdown,
    excluded,
    exclusionReason,
    recommendation,
    recommendationWhy: why,
    effortEstimate,
    priority,
    procurementRoute,
    buyerType,
    region,
  };
}

export function scoreTenders(tenders: RawTender[]): ScoredTender[] {
  return tenders
    .map(scoreTender)
    .sort((a, b) => b.score.total - a.score.total);
}
