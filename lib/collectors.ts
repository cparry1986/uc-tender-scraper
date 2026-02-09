import { RawTender, SourceHealth } from "./types";

// ── Config ─────────────────────────────────────────────────────────────

const SEARCH_KEYWORDS = [
  // Core supply terms
  "electricity supply",
  "supply of electricity",
  "energy supply",
  "supply of energy",
  "electricity",
  // Frameworks & procurement
  "electricity framework",
  "energy framework",
  "electricity procurement",
  "energy procurement",
  "electricity contract",
  "energy contract",
  "utility supply",
  "utilities contract",
  // Commercial models
  "power purchase agreement",
  "sleeved",
  "demand pool",
  "flexible purchasing",
  "half hourly",
  "HH supply",
  "HH meter",
  // Renewables / green
  "renewable energy",
  "green energy",
  "REGO",
  "green new deal",
  "net zero energy",
  "carbon neutral energy",
  // Combined fuels
  "gas and electricity",
  "electricity and gas",
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

  for (const keyword of SEARCH_KEYWORDS.slice(0, 8)) {
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
  "electricity+contract",
  "sleeved+electricity",
  "demand+pool",
  "half+hourly+electricity",
  "green+new+deal",
  "renewable+energy+supply",
  "utility+supply",
  "net+zero+energy",
  "electricity+meter",
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

// ── FTS Award Notices (who won previous contracts) ───────────────────

export interface AwardNotice {
  title: string;
  buyer: string;
  winner: string;
  value: number | null;
  awardDate: string;
  region: string;
  url: string;
}

async function fetchFTSAwards(): Promise<AwardNotice[]> {
  const awards: AwardNotice[] = [];
  const awardKeywords = [
    "electricity supply",
    "energy supply",
    "electricity framework",
    "gas and electricity",
    "sleeved",
    "half hourly",
  ];

  for (const keyword of awardKeywords.slice(0, 4)) {
    try {
      const url =
        `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?` +
        `keyword=${encodeURIComponent(keyword)}` +
        `&stage=award&size=50`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      const packages = data.results || data.releases || data.releasePackages || [];
      for (const pkg of packages) {
        const releases = pkg.releases || [pkg];
        for (const r of releases) {
          const awardList = Array.isArray(r.awards) ? r.awards : [];
          const buyer = (r.buyer || pkg?.buyer || {}) as Record<string, unknown>;
          const tender = (r.tender || {}) as Record<string, unknown>;
          const ocid = String(r.ocid || r.id || pkg?.ocid || "");
          const title = String(tender.title || r.title || "");
          const noticeId = ocid.replace(/^ocds-[a-z0-9]+-/i, "");

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

          for (const aw of awardList) {
            const a = aw as Record<string, unknown>;
            const suppliers = Array.isArray(a.suppliers) ? a.suppliers : [];
            const winner = suppliers.length > 0
              ? String((suppliers[0] as Record<string, unknown>).name || "Unknown")
              : "Unknown";
            const valueObj = (a.value || {}) as Record<string, unknown>;
            const value = Number(valueObj.amount || 0) || null;
            const awardDate = String(a.date || r.datePublished || "");

            awards.push({
              title,
              buyer: String(buyer.name || ""),
              winner,
              value,
              awardDate,
              region: location,
              url: `https://www.find-tender.service.gov.uk/Notice/${noticeId}`,
            });
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return awards.filter((a) => {
    const key = `${a.title.toLowerCase()}|${a.buyer.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (b.awardDate || "").localeCompare(a.awardDate || ""));
}

function monthNum(m: string): string {
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  return months[m.toLowerCase().slice(0, 3)] || "01";
}

// ── Public Contracts Scotland (PCS) ───────────────────────────────────

const PCS_QUERIES = [
  "electricity+supply",
  "energy+supply",
  "electricity+framework",
  "supply+of+electricity",
  "gas+and+electricity",
  "electricity+contract",
  "sleeved",
  "half+hourly",
  "green+energy",
  "renewable+energy",
  "utility+supply",
];

async function fetchPCS(): Promise<RawTender[]> {
  const seen = new Map<string, RawTender>();

  for (const q of PCS_QUERIES) {
    const url = `https://www.publiccontractsscotland.gov.uk/Search/Search_MainPage.aspx?Search_String=${q}&Status=Open`;
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
      const tenders = parsePCSHtml(html);
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

function parsePCSHtml(html: string): RawTender[] {
  const tenders: RawTender[] = [];
  // PCS uses table-based layout with links to notice details
  const noticePattern =
    /<a[^>]+href="[^"]*(?:Notice|Search_Detail)[^"]*(?:\?|&amp;)ID=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = noticePattern.exec(html)) !== null) {
    const noticeId = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, "").trim();
    if (!linkText || linkText.length < 10) continue;

    const id = `pcs-${noticeId}`;
    if (tenders.some((t) => t.id === id)) continue;

    // Extract surrounding context for buyer and value
    const context = html.slice(
      Math.max(0, match.index - 500),
      match.index + match[0].length + 500
    );
    const buyerMatch = context.match(
      /(?:Organisation|Buyer|Authority)[:\s]*([^<\n]{5,80})/i
    );
    const valueMatch = context.match(
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
    const dateMatch = context.match(
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );
    const deadlineMatch = context.match(
      /(?:deadline|closing)[:\s]*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );

    tenders.push({
      id,
      title: linkText,
      description: "",
      publishedDate: dateMatch
        ? `${dateMatch[3]}-${monthNum(dateMatch[2])}-${dateMatch[1].padStart(2, "0")}`
        : "",
      deadlineDate: deadlineMatch
        ? `${deadlineMatch[3]}-${monthNum(deadlineMatch[2])}-${deadlineMatch[1].padStart(2, "0")}`
        : null,
      value,
      currency: "GBP",
      buyer: buyerMatch ? buyerMatch[1].trim() : "",
      location: "Scotland",
      source: "pcs",
      url: `https://www.publiccontractsscotland.gov.uk/Search/Search_Detail.aspx?ID=${noticeId}`,
      cpvCodes: [],
    });
  }

  return tenders;
}

// ── Sell2Wales (RSS Feed) ────────────────────────────────────────────

async function fetchSell2Wales(): Promise<RawTender[]> {
  const tenders: RawTender[] = [];
  const rssUrls = [
    "https://www.sell2wales.gov.wales/RSSFeed/RSS.aspx?Ession=electricity+supply",
    "https://www.sell2wales.gov.wales/RSSFeed/RSS.aspx?Ession=energy+supply",
    "https://www.sell2wales.gov.wales/RSSFeed/RSS.aspx?Ession=electricity+framework",
    "https://www.sell2wales.gov.wales/RSSFeed/RSS.aspx?Ession=gas+and+electricity",
    "https://www.sell2wales.gov.wales/RSSFeed/RSS.aspx?Ession=electricity+contract",
    "https://www.sell2wales.gov.wales/RSSFeed/RSS.aspx?Ession=renewable+energy",
    "https://www.sell2wales.gov.wales/RSSFeed/RSS.aspx?Ession=utility+supply",
    "https://www.sell2wales.gov.wales/RSSFeed/RSS.aspx?Ession=green+energy",
  ];
  const seen = new Map<string, RawTender>();

  for (const url of rssUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml",
          "User-Agent":
            "UrbanChain-TenderScraper/2.0 (electricity-supply-monitoring)",
        },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const items = parseSell2WalesRss(xml);
      for (const t of items) {
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

function parseSell2WalesRss(xml: string): RawTender[] {
  const tenders: RawTender[] = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemPattern.exec(xml)) !== null) {
    const item = match[1];
    const title = extractXmlTag(item, "title");
    const link = extractXmlTag(item, "link");
    const description = extractXmlTag(item, "description");
    const pubDate = extractXmlTag(item, "pubDate");

    if (!title || !link) continue;

    // Extract ID from link
    const idMatch = link.match(/[?&]ID=(\d+)/i) || link.match(/\/(\d+)\/?$/);
    const noticeId = idMatch ? idMatch[1] : title.replace(/[^a-z0-9]/gi, "-").slice(0, 40);

    // Parse value from description/title
    const valueMatch = (description || title).match(
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

    // Parse buyer from description
    const buyerMatch = (description || "").match(
      /(?:published\s+by|buyer|organisation)[:\s]*([^<\n.]{5,80})/i
    );

    // Parse pubDate
    let publishedDate = "";
    if (pubDate) {
      try {
        publishedDate = new Date(pubDate).toISOString().split("T")[0];
      } catch {
        publishedDate = "";
      }
    }

    tenders.push({
      id: `s2w-${noticeId}`,
      title,
      description: description || "",
      publishedDate,
      deadlineDate: null,
      value,
      currency: "GBP",
      buyer: buyerMatch ? buyerMatch[1].trim() : "",
      location: "Wales",
      source: "sell2wales",
      url: link,
      cpvCodes: [],
    });
  }

  return tenders;
}

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i")
  );
  return match ? match[1].trim() : "";
}

// ── D3 Tenders (CPV Division 09 - Energy) ───────────────────────────

async function fetchD3Tenders(): Promise<RawTender[]> {
  const seen = new Map<string, RawTender>();
  const urls = [
    "https://d3tenders.co.uk/cpv/09",       // Energy, mining, fuels
    "https://d3tenders.co.uk/cpv/093",      // Electricity & related
    "https://d3tenders.co.uk/cpv/09310000", // Electricity
    "https://d3tenders.co.uk/cpv/65310000", // Electricity distribution
  ];

  for (const url of urls) {
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
      const tenders = parseD3Html(html);
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

function parseD3Html(html: string): RawTender[] {
  const tenders: RawTender[] = [];
  // D3 Tenders lists contracts with links to detail pages
  const linkPattern =
    /<a[^>]+href="(\/(?:tender|contract|notice)s?\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const path = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, "").trim();
    if (!linkText || linkText.length < 10) continue;

    const id = `d3-${path.replace(/[^a-z0-9]/gi, "-")}`;
    if (tenders.some((t) => t.id === id)) continue;

    const context = html.slice(
      Math.max(0, match.index - 500),
      match.index + match[0].length + 500
    );
    const buyerMatch = context.match(
      /(?:buyer|organisation|authority|contracting)[:\s]*([^<\n]{5,80})/i
    );
    const valueMatch = context.match(
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
    const dateMatch = context.match(
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );
    const deadlineMatch = context.match(
      /(?:deadline|closing|closes)[:\s]*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );

    // Extract CPV code from context
    const cpvMatch = context.match(/(09\d{6}|65\d{6}|31682\d{3})/);
    const cpvCodes = cpvMatch ? [cpvMatch[1]] : [];

    tenders.push({
      id,
      title: linkText,
      description: "",
      publishedDate: dateMatch
        ? `${dateMatch[3]}-${monthNum(dateMatch[2])}-${dateMatch[1].padStart(2, "0")}`
        : "",
      deadlineDate: deadlineMatch
        ? `${deadlineMatch[3]}-${monthNum(deadlineMatch[2])}-${deadlineMatch[1].padStart(2, "0")}`
        : null,
      value,
      currency: "GBP",
      buyer: buyerMatch ? buyerMatch[1].trim() : "",
      location: "",
      source: "d3-tenders",
      url: `https://d3tenders.co.uk${path}`,
      cpvCodes,
    });
  }

  return tenders;
}

// ── The Chest (Proactis / Due North — NW England) ────────────────────

const CHEST_QUERIES = [
  "electricity",
  "energy supply",
  "electricity supply",
  "gas and electricity",
  "utility supply",
  "sleeved",
  "demand pool",
  "half hourly",
  "green new deal",
  "net zero",
  "renewable energy",
  "energy contract",
];

async function fetchTheChest(): Promise<RawTender[]> {
  const seen = new Map<string, RawTender>();

  for (const q of CHEST_QUERIES) {
    // The Chest (Due North/Proactis) search endpoint
    const url =
      `https://procontract.due-north.com/Opportunities/Index?` +
      `keywords=${encodeURIComponent(q)}&status=Open`;
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
      const tenders = parseChestHtml(html);
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

function parseChestHtml(html: string): RawTender[] {
  const tenders: RawTender[] = [];
  // Proactis/Due North uses links to opportunity detail pages
  const linkPattern =
    /<a[^>]+href="[^"]*(?:Opportunity|Detail)[^"]*[?&](?:id|opportunityId)=([a-f0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const opportunityId = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, "").trim();
    if (!linkText || linkText.length < 10) continue;

    const id = `chest-${opportunityId}`;
    if (tenders.some((t) => t.id === id)) continue;

    const context = html.slice(
      Math.max(0, match.index - 500),
      match.index + match[0].length + 500
    );
    const buyerMatch = context.match(
      /(?:buyer|organisation|authority|published\s+by)[:\s]*([^<\n]{5,80})/i
    );
    const valueMatch = context.match(
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
    const dateMatch = context.match(
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );
    const deadlineMatch = context.match(
      /(?:deadline|closing|closes|return\s+date)[:\s]*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );

    tenders.push({
      id,
      title: linkText,
      description: "",
      publishedDate: dateMatch
        ? `${dateMatch[3]}-${monthNum(dateMatch[2])}-${dateMatch[1].padStart(2, "0")}`
        : "",
      deadlineDate: deadlineMatch
        ? `${deadlineMatch[3]}-${monthNum(deadlineMatch[2])}-${deadlineMatch[1].padStart(2, "0")}`
        : null,
      value,
      currency: "GBP",
      buyer: buyerMatch ? buyerMatch[1].trim() : "",
      location: "North West",
      source: "the-chest",
      url: `https://procontract.due-north.com/Opportunities/Opportunity?id=${opportunityId}`,
      cpvCodes: [],
    });
  }

  return tenders;
}

// ── eTendersNI (Northern Ireland official portal) ─────────────────────

const NI_QUERIES = [
  "electricity+supply",
  "energy+supply",
  "electricity+framework",
  "gas+and+electricity",
  "electricity+contract",
  "utility+supply",
  "renewable+energy",
  "electricity",
];

async function fetchETendersNI(): Promise<RawTender[]> {
  const seen = new Map<string, RawTender>();

  for (const q of NI_QUERIES) {
    const url = `https://etendersni.gov.uk/epps/cft/listContractNotices.do?d-4014458-p=1&selectedList=CURRENT_LIST&keyword=${q}`;
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
      const tenders = parseETendersNIHtml(html);
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

function parseETendersNIHtml(html: string): RawTender[] {
  const tenders: RawTender[] = [];
  const linkPattern =
    /<a[^>]+href="[^"]*(?:prepareViewCfTWS|viewContractNotice)[^"]*(?:\?|&amp;)resourceId=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const resourceId = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, "").trim();
    if (!linkText || linkText.length < 10) continue;

    const id = `ni-${resourceId}`;
    if (tenders.some((t) => t.id === id)) continue;

    const context = html.slice(
      Math.max(0, match.index - 500),
      match.index + match[0].length + 500
    );
    const buyerMatch = context.match(
      /(?:buyer|organisation|authority|contracting)[:\s]*([^<\n]{5,80})/i
    );
    const valueMatch = context.match(
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
    const dateMatch = context.match(
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );
    const deadlineMatch = context.match(
      /(?:deadline|closing|closes|return)[:\s]*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );

    tenders.push({
      id,
      title: linkText,
      description: "",
      publishedDate: dateMatch
        ? `${dateMatch[3]}-${monthNum(dateMatch[2])}-${dateMatch[1].padStart(2, "0")}`
        : "",
      deadlineDate: deadlineMatch
        ? `${deadlineMatch[3]}-${monthNum(deadlineMatch[2])}-${deadlineMatch[1].padStart(2, "0")}`
        : null,
      value,
      currency: "GBP",
      buyer: buyerMatch ? buyerMatch[1].trim() : "",
      location: "Northern Ireland",
      source: "etendersni",
      url: `https://etendersni.gov.uk/epps/cft/prepareViewCfTWS.do?resourceId=${resourceId}`,
      cpvCodes: [],
    });
  }

  return tenders;
}

// ── Delta eSourcing (multi-council platform) ──────────────────────────

const DELTA_QUERIES = [
  "electricity supply",
  "energy supply",
  "electricity framework",
  "gas and electricity",
  "electricity contract",
  "utility supply",
  "sleeved",
  "half hourly",
  "electricity",
  "renewable energy",
];

async function fetchDelta(): Promise<RawTender[]> {
  const seen = new Map<string, RawTender>();

  for (const q of DELTA_QUERIES) {
    const url = `https://www.delta-esourcing.com/tenders?keywords=${encodeURIComponent(q)}`;
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
      const tenders = parseDeltaHtml(html);
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

function parseDeltaHtml(html: string): RawTender[] {
  const tenders: RawTender[] = [];
  const linkPattern =
    /<a[^>]+href="[^"]*(?:\/tender(?:s|Detail)?\/|viewNotice[^"]*[?&]id=)([a-zA-Z0-9-]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const tenderId = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, "").trim();
    if (!linkText || linkText.length < 10) continue;

    const id = `delta-${tenderId}`;
    if (tenders.some((t) => t.id === id)) continue;

    const context = html.slice(
      Math.max(0, match.index - 500),
      match.index + match[0].length + 500
    );
    const buyerMatch = context.match(
      /(?:buyer|organisation|authority|published\s+by|contracting)[:\s]*([^<\n]{5,80})/i
    );
    const valueMatch = context.match(
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
    const dateMatch = context.match(
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );
    const deadlineMatch = context.match(
      /(?:deadline|closing|closes|return\s+date)[:\s]*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );

    tenders.push({
      id,
      title: linkText,
      description: "",
      publishedDate: dateMatch
        ? `${dateMatch[3]}-${monthNum(dateMatch[2])}-${dateMatch[1].padStart(2, "0")}`
        : "",
      deadlineDate: deadlineMatch
        ? `${deadlineMatch[3]}-${monthNum(deadlineMatch[2])}-${deadlineMatch[1].padStart(2, "0")}`
        : null,
      value,
      currency: "GBP",
      buyer: buyerMatch ? buyerMatch[1].trim() : "",
      location: "",
      source: "delta",
      url: `https://www.delta-esourcing.com/tenders/${tenderId}`,
      cpvCodes: [],
    });
  }

  return tenders;
}

// ── Due North / ProContract Regional Portals ──────────────────────────

interface DueNorthPortal {
  baseUrl: string;
  name: string;
  region: string;
}

const DUE_NORTH_PORTALS: DueNorthPortal[] = [
  {
    baseUrl: "https://www.yortender.co.uk/procontract/Opportunities/Index",
    name: "YORtender",
    region: "North East / Yorkshire",
  },
  {
    baseUrl: "https://www.supplyingthesouthwest.org.uk/procontract/Opportunities/Index",
    name: "South West",
    region: "South West",
  },
];

const DUE_NORTH_QUERIES = [
  "electricity",
  "energy supply",
  "electricity supply",
  "gas and electricity",
  "utility supply",
  "renewable energy",
];

async function fetchDueNorthPortals(): Promise<RawTender[]> {
  const seen = new Map<string, RawTender>();

  for (const portal of DUE_NORTH_PORTALS) {
    for (const q of DUE_NORTH_QUERIES.slice(0, 4)) {
      const url = `${portal.baseUrl}?keywords=${encodeURIComponent(q)}&status=Open`;
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
        const tenders = parseDueNorthHtml(html, portal);
        for (const t of tenders) {
          if (!seen.has(t.id)) {
            seen.set(t.id, t);
          }
        }
      } catch {
        continue;
      }
    }
  }

  return Array.from(seen.values());
}

function parseDueNorthHtml(html: string, portal: DueNorthPortal): RawTender[] {
  const tenders: RawTender[] = [];
  const linkPattern =
    /<a[^>]+href="[^"]*(?:Opportunity|Detail|Notice)[^"]*[?&](?:id|opportunityId|noticeId)=([a-f0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const opportunityId = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, "").trim();
    if (!linkText || linkText.length < 10) continue;

    const id = `dn-${portal.name.replace(/\s+/g, "").toLowerCase()}-${opportunityId}`;
    if (tenders.some((t) => t.id === id)) continue;

    const context = html.slice(
      Math.max(0, match.index - 500),
      match.index + match[0].length + 500
    );
    const buyerMatch = context.match(
      /(?:buyer|organisation|authority|published\s+by)[:\s]*([^<\n]{5,80})/i
    );
    const valueMatch = context.match(
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
    const dateMatch = context.match(
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );
    const deadlineMatch = context.match(
      /(?:deadline|closing|closes|return\s+date)[:\s]*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i
    );

    tenders.push({
      id,
      title: linkText,
      description: "",
      publishedDate: dateMatch
        ? `${dateMatch[3]}-${monthNum(dateMatch[2])}-${dateMatch[1].padStart(2, "0")}`
        : "",
      deadlineDate: deadlineMatch
        ? `${deadlineMatch[3]}-${monthNum(deadlineMatch[2])}-${deadlineMatch[1].padStart(2, "0")}`
        : null,
      value,
      currency: "GBP",
      buyer: buyerMatch ? buyerMatch[1].trim() : "",
      location: portal.region,
      source: "due-north",
      url: `${portal.baseUrl.replace(/\/Index$/, "")}/Opportunity?id=${opportunityId}`,
      cpvCodes: [],
    });
  }

  return tenders;
}

// ── Contracts Finder Awards (historical intelligence) ────────────────

async function fetchContractsFinderAwards(days: number): Promise<AwardNotice[]> {
  const awards: AwardNotice[] = [];
  const since = daysAgoISO(Math.max(days, 180));
  const until = todayISO();

  let cursor: string | null = null;
  const maxPages = 3;

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
        const tender = (r.tender || {}) as Record<string, unknown>;
        const buyer = (r.buyer || {}) as Record<string, unknown>;
        const title = String(tender.title || r.title || "");
        const text = `${title} ${String(tender.description || "")}`.toLowerCase();

        if (
          !/electricity|energy\s+supply|gas\s+and\s+electric|utility\s+supply|half[\s-]?hourly|sleeved|renewable\s+energy|power\s+purchase/.test(
            text
          )
        )
          continue;

        const awardList = Array.isArray(r.awards) ? r.awards : [];
        if (awardList.length === 0) continue;

        const ocid = String(r.ocid || r.id || "");
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

        for (const aw of awardList) {
          const a = aw as Record<string, unknown>;
          const suppliers = Array.isArray(a.suppliers) ? a.suppliers : [];
          const winner =
            suppliers.length > 0
              ? String(
                  (suppliers[0] as Record<string, unknown>).name || "Unknown"
                )
              : "Unknown";
          const valueObj = (a.value || {}) as Record<string, unknown>;
          const value = Number(valueObj.amount || 0) || null;
          const awardDate = String(a.date || r.datePublished || "");

          awards.push({
            title,
            buyer: String(buyer.name || ""),
            winner,
            value,
            awardDate,
            region: location,
            url: `https://www.contractsfinder.service.gov.uk/Notice/${ocid}`,
          });
        }
      }

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

  return awards;
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
  recentAwards: AwardNotice[];
}

export async function collectTenders(days: number): Promise<CollectionResult> {
  const [
    fatResult,
    fatPipelineResult,
    cfResult,
    bsResult,
    pcsResult,
    s2wResult,
    d3Result,
    chestResult,
    niResult,
    deltaResult,
    dueNorthResult,
    ftsAwardsResult,
    cfAwardsResult,
  ] = await Promise.allSettled([
    fetchFindATender(days),
    fetchFindATenderPipeline(Math.max(days, 30)),
    fetchContractsFinder(days),
    fetchBidstats(),
    fetchPCS(),
    fetchSell2Wales(),
    fetchD3Tenders(),
    fetchTheChest(),
    fetchETendersNI(),
    fetchDelta(),
    fetchDueNorthPortals(),
    fetchFTSAwards(),
    fetchContractsFinderAwards(days),
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
  const pcsTenders =
    pcsResult.status === "fulfilled" ? pcsResult.value : [];
  const s2wTenders =
    s2wResult.status === "fulfilled" ? s2wResult.value : [];
  const d3Tenders =
    d3Result.status === "fulfilled" ? d3Result.value : [];
  const chestTenders =
    chestResult.status === "fulfilled" ? chestResult.value : [];
  const niTenders =
    niResult.status === "fulfilled" ? niResult.value : [];
  const deltaTenders =
    deltaResult.status === "fulfilled" ? deltaResult.value : [];
  const dueNorthTenders =
    dueNorthResult.status === "fulfilled" ? dueNorthResult.value : [];

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
    {
      name: "PCS (Scotland)",
      ok: pcsResult.status === "fulfilled",
      count: pcsTenders.length,
    },
    {
      name: "Sell2Wales",
      ok: s2wResult.status === "fulfilled",
      count: s2wTenders.length,
    },
    {
      name: "D3 Tenders",
      ok: d3Result.status === "fulfilled",
      count: d3Tenders.length,
    },
    {
      name: "The Chest (NW)",
      ok: chestResult.status === "fulfilled",
      count: chestTenders.length,
    },
    {
      name: "eTendersNI",
      ok: niResult.status === "fulfilled",
      count: niTenders.length,
    },
    {
      name: "Delta eSourcing",
      ok: deltaResult.status === "fulfilled",
      count: deltaTenders.length,
    },
    {
      name: "Due North Portals",
      ok: dueNorthResult.status === "fulfilled",
      count: dueNorthTenders.length,
    },
  ];

  const all = [
    ...fatTenders,
    ...fatPipeline,
    ...cfTenders,
    ...bsTenders,
    ...pcsTenders,
    ...s2wTenders,
    ...d3Tenders,
    ...chestTenders,
    ...niTenders,
    ...deltaTenders,
    ...dueNorthTenders,
  ];
  const deduped = dedup(all);

  // Merge awards from both FTS and Contracts Finder
  const ftsAwards =
    ftsAwardsResult.status === "fulfilled" ? ftsAwardsResult.value : [];
  const cfAwards =
    cfAwardsResult.status === "fulfilled" ? cfAwardsResult.value : [];
  const allAwards = [...ftsAwards, ...cfAwards];

  // Deduplicate awards
  const seenAwards = new Set<string>();
  const recentAwards = allAwards
    .filter((a) => {
      const key = `${a.title.toLowerCase()}|${a.buyer.toLowerCase()}`;
      if (seenAwards.has(key)) return false;
      seenAwards.add(key);
      return true;
    })
    .sort((a, b) => (b.awardDate || "").localeCompare(a.awardDate || ""));

  return { tenders: deduped, sourceHealth, recentAwards };
}
