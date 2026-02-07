import { RawTender, SourceHealth } from "./types";

// ── Config ─────────────────────────────────────────────────────────────

const SEARCH_KEYWORDS = [
  "electricity supply",
  "supply of electricity",
  "energy supply",
  "electricity framework",
  "power purchase agreement",
  "gas and electricity",
  "electricity procurement",
  "renewable energy supply",
  "electricity contract",
  "energy framework",
  "utility supply",
];

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Find a Tender (OCDS API) ──────────────────────────────────────────

async function fetchFindATender(days: number): Promise<RawTender[]> {
  const since = daysAgoISO(days);
  const until = todayISO();
  const seen = new Map<string, RawTender>();

  for (const keyword of SEARCH_KEYWORDS) {
    const url =
      `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?` +
      `publishedFrom=${since}&publishedTo=${until}` +
      `&keyword=${encodeURIComponent(keyword)}` +
      `&stage=tender&size=100`;

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        const packages = data.results || data.releases || data.releasePackages || [];
        for (const pkg of packages) {
          const releases = pkg.releases || [pkg];
          for (const r of releases) {
            const mapped = mapFaTRelease(r, pkg);
            if (!seen.has(mapped.id)) {
              seen.set(mapped.id, mapped);
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  return Array.from(seen.values());
}

async function fetchFindATenderPipeline(days: number): Promise<RawTender[]> {
  const since = daysAgoISO(days);
  const until = todayISO();
  const seen = new Map<string, RawTender>();

  for (const keyword of SEARCH_KEYWORDS.slice(0, 4)) {
    const url =
      `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?` +
      `publishedFrom=${since}&publishedTo=${until}` +
      `&keyword=${encodeURIComponent(keyword)}` +
      `&stage=planning&size=100`;

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        const packages = data.results || data.releases || data.releasePackages || [];
        for (const pkg of packages) {
          const releases = pkg.releases || [pkg];
          for (const r of releases) {
            const mapped = mapFaTRelease(r, pkg);
            mapped.isPipeline = true;
            if (!seen.has(mapped.id)) {
              seen.set(mapped.id, mapped);
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  return Array.from(seen.values());
}

function mapFaTRelease(
  r: Record<string, unknown>,
  pkg?: Record<string, unknown>
): RawTender {
  const tender = (r.tender || {}) as Record<string, unknown>;
  const buyerObj = (r.buyer || pkg?.buyer || {}) as Record<string, unknown>;
  const ocid = String(r.ocid || r.id || pkg?.ocid || "");
  const releaseId = String(r.id || ocid);
  const title = String(tender.title || r.title || "");
  const description = String(tender.description || r.description || "");
  const datePublished = String(
    r.datePublished || r.publishedDate || r.date || ""
  );
  const tenderPeriod = (tender.tenderPeriod || {}) as Record<string, unknown>;
  const deadlineDate = tenderPeriod.endDate
    ? String(tenderPeriod.endDate)
    : null;
  const valueObj = (tender.value || tender.minValue || {}) as Record<
    string,
    unknown
  >;
  const value = Number(valueObj.amount || 0) || null;
  const items = Array.isArray(tender.items) ? tender.items : [];
  const cpvCodes: string[] = [];
  for (const item of items) {
    const cls = (item as Record<string, unknown>).classification as
      | Record<string, unknown>
      | undefined;
    if (cls?.id) cpvCodes.push(String(cls.id));
  }
  const deliveryAddresses = Array.isArray(tender.deliveryAddresses)
    ? tender.deliveryAddresses
    : [];
  const location =
    deliveryAddresses.length > 0
      ? String(
          (deliveryAddresses[0] as Record<string, unknown>).region ||
            (deliveryAddresses[0] as Record<string, unknown>).locality ||
            ""
        )
      : "";
  const noticeId = ocid.replace(/^ocds-[a-z0-9]+-/i, "");

  return {
    id: `fat-${releaseId}`,
    title,
    description,
    publishedDate: datePublished,
    deadlineDate,
    value,
    currency: "GBP",
    buyer: String(buyerObj.name || ""),
    location,
    source: "find-a-tender",
    url: `https://www.find-tender.service.gov.uk/Notice/${noticeId}`,
    cpvCodes,
  };
}

// ── Contracts Finder (OCDS API with pagination) ────────────────────────

async function fetchContractsFinder(days: number): Promise<RawTender[]> {
  const since = daysAgoISO(days);
  const until = todayISO();
  const seen = new Map<string, RawTender>();
  const maxPages = 5;

  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    let url =
      `https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?` +
      `publishedFrom=${since}&publishedTo=${until}&limit=100`;
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) break;

      const data = await res.json();
      const releases = data.releases || [];
      if (releases.length === 0) break;

      for (const r of releases) {
        const mapped = mapCfRelease(r);
        if (!seen.has(mapped.id)) {
          seen.set(mapped.id, mapped);
        }
      }

      // Pagination via next link
      const nextLink = data.links?.next || data.next || null;
      if (!nextLink) break;

      try {
        const nextUrl = new URL(
          nextLink,
          "https://www.contractsfinder.service.gov.uk"
        );
        cursor = nextUrl.searchParams.get("cursor");
        if (!cursor) break;
      } catch {
        break;
      }
    } catch {
      break;
    }
  }

  return Array.from(seen.values());
}

function mapCfRelease(r: Record<string, unknown>): RawTender {
  const tender = (r.tender || {}) as Record<string, unknown>;
  const buyer = (r.buyer || {}) as Record<string, unknown>;
  const ocid = String(r.ocid || r.id || "");
  const title = String(tender.title || r.title || "");
  const description = String(tender.description || r.description || "");
  const datePublished = String(r.datePublished || r.publishedDate || "");
  const tenderPeriod = (tender.tenderPeriod || {}) as Record<string, unknown>;
  const deadlineDate = tenderPeriod.endDate
    ? String(tenderPeriod.endDate)
    : null;
  const valueObj = (tender.value || {}) as Record<string, unknown>;
  const value = Number(valueObj.amount || 0) || null;
  const items = Array.isArray(tender.items) ? tender.items : [];
  const cpvCodes: string[] = [];
  for (const item of items) {
    const cls = (item as Record<string, unknown>).classification as
      | Record<string, unknown>
      | undefined;
    if (cls?.id) cpvCodes.push(String(cls.id));
  }
  const deliveryAddresses = Array.isArray(tender.deliveryAddresses)
    ? tender.deliveryAddresses
    : [];
  const location =
    deliveryAddresses.length > 0
      ? String(
          (deliveryAddresses[0] as Record<string, unknown>).region ||
            (deliveryAddresses[0] as Record<string, unknown>).locality ||
            ""
        )
      : "";

  return {
    id: `cf-${ocid}`,
    title,
    description,
    publishedDate: datePublished,
    deadlineDate,
    value,
    currency: "GBP",
    buyer: String(buyer.name || ""),
    location,
    source: "contracts-finder",
    url: `https://www.contractsfinder.service.gov.uk/Notice/${ocid}`,
    cpvCodes,
  };
}

// ── Bidstats.uk Scraper ────────────────────────────────────────────────

const BIDSTATS_QUERIES = [
  "electricity+supply",
  "energy+supply",
  "electricity+framework",
  "power+purchase+agreement",
  "supply+of+electricity",
  "gas+and+electricity",
];

async function fetchBidstats(): Promise<RawTender[]> {
  const seen = new Map<string, RawTender>();

  for (const q of BIDSTATS_QUERIES) {
    const url = `https://bidstats.uk/tenders?q=${q}`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "text/html",
          "User-Agent":
            "UrbanChain-TenderScraper/2.0 (electricity-supply-monitoring)",
        },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;

      const html = await res.text();
      const tenders = parseBidstatsHtml(html);
      for (const t of tenders) {
        if (!seen.has(t.id)) {
          seen.set(t.id, t);
        }
      }
    } catch {
      continue;
    }
  }

  return Array.from(seen.values());
}

function parseBidstatsHtml(html: string): RawTender[] {
  const tenders: RawTender[] = [];
  const tenderPattern =
    /<a[^>]+href="(\/tenders\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = tenderPattern.exec(html)) !== null) {
    const path = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, "").trim();
    if (!linkText || linkText.length < 10) continue;

    const id = `bs-${path.replace(/[^a-z0-9]/gi, "-")}`;
    if (tenders.some((t) => t.id === id)) continue;

    // Extract buyer from surrounding context
    const context = html.slice(
      Math.max(0, match.index - 500),
      match.index + match[0].length + 500
    );
    const buyerMatch = context.match(
      /(?:buyer|organisation|authority)[:\s]*([^<\n]{5,80})/i
    );

    // Extract value
    const valueContext = html.slice(match.index, match.index + 1000);
    const valueMatch = valueContext.match(
      /[\u00A3\xA3]([0-9,.]+)\s*(m|k|million|thousand)?/i
    );
    let value: number | null = null;
    if (valueMatch) {
      const num = parseFloat(valueMatch[1].replace(/,/g, ""));
      const mult = valueMatch[2]?.toLowerCase();
      if (mult === "m" || mult === "million") value = num * 1_000_000;
      else if (mult === "k" || mult === "thousand") value = num * 1_000;
      else value = num;
    }

    // Extract date
    const dateMatch = valueContext.match(
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );
    const publishedDate = dateMatch
      ? `${dateMatch[3]}-${monthNum(dateMatch[2])}-${dateMatch[1].padStart(2, "0")}`
      : "";

    tenders.push({
      id,
      title: linkText,
      description: "",
      publishedDate,
      deadlineDate: null,
      value,
      currency: "GBP",
      buyer: buyerMatch ? buyerMatch[1].trim() : "",
      location: "",
      source: "bidstats",
      url: `https://bidstats.uk${path}`,
      cpvCodes: [],
    });
  }

  return tenders;
}

function monthNum(m: string): string {
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  return months[m.toLowerCase().slice(0, 3)] || "01";
}

// ── Deduplication ──────────────────────────────────────────────────────

function dedup(tenders: RawTender[]): RawTender[] {
  const seen = new Map<string, RawTender>();
  for (const t of tenders) {
    const key = `${t.title.toLowerCase().trim()}|${t.buyer.toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.set(key, t);
    }
  }
  return Array.from(seen.values());
}

// ── Public API ─────────────────────────────────────────────────────────

export interface CollectionResult {
  tenders: RawTender[];
  sourceHealth: SourceHealth[];
}

export async function collectTenders(days: number): Promise<CollectionResult> {
  const [fatResult, fatPipelineResult, cfResult, bsResult] =
    await Promise.allSettled([
      fetchFindATender(days),
      fetchFindATenderPipeline(Math.max(days, 14)),
      fetchContractsFinder(days),
      fetchBidstats(),
    ]);

  const fatTenders =
    fatResult.status === "fulfilled" ? fatResult.value : [];
  const fatPipeline =
    fatPipelineResult.status === "fulfilled"
      ? fatPipelineResult.value
      : [];
  const cfTenders =
    cfResult.status === "fulfilled" ? cfResult.value : [];
  const bsTenders =
    bsResult.status === "fulfilled" ? bsResult.value : [];

  const sourceHealth: SourceHealth[] = [
    {
      name: "Find a Tender",
      ok: fatResult.status === "fulfilled" && fatTenders.length > 0,
      count: fatTenders.length,
    },
    {
      name: "FTS Pipeline",
      ok: fatPipelineResult.status === "fulfilled" && fatPipeline.length > 0,
      count: fatPipeline.length,
    },
    {
      name: "Contracts Finder",
      ok: cfResult.status === "fulfilled" && cfTenders.length > 0,
      count: cfTenders.length,
    },
    {
      name: "Bidstats",
      ok: bsResult.status === "fulfilled" && bsTenders.length > 0,
      count: bsTenders.length,
    },
  ];

  const all = [...fatTenders, ...fatPipeline, ...cfTenders, ...bsTenders];
  const deduped = dedup(all);

  return { tenders: deduped, sourceHealth };
}
