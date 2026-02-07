import { RawTender } from "./types";

const CPV_ELECTRICITY = "09310000";

const KEYWORD_FALLBACKS = [
  "supply of electricity",
  "electricity supply",
  "power purchase agreement",
  "licensed electricity supplier",
  "electricity procurement",
];

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

// ── Find a Tender (UK e-procurement) ──────────────────────────────────

async function fetchFindATender(days: number): Promise<RawTender[]> {
  const since = daysAgoISO(days);
  const tenders: RawTender[] = [];

  // Try CPV code search first
  const cpvUrl =
    `https://www.find-tender.service.gov.uk/api/1.0/notices?` +
    `cpvCodes=${CPV_ELECTRICITY}&publishedFrom=${since}&size=100`;

  try {
    const res = await fetch(cpvUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = await res.json();
      const notices = data.results || data.notices || [];
      for (const n of notices) {
        tenders.push(mapFaTNotice(n));
      }
    }
  } catch {
    // CPV search failed, fall through to keyword fallback
  }

  // Keyword fallback — only if CPV returned nothing
  if (tenders.length === 0) {
    for (const keyword of KEYWORD_FALLBACKS) {
      const kwUrl =
        `https://www.find-tender.service.gov.uk/api/1.0/notices?` +
        `keyword=${encodeURIComponent(keyword)}&publishedFrom=${since}&size=50`;
      try {
        const res = await fetch(kwUrl, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const data = await res.json();
          const notices = data.results || data.notices || [];
          for (const n of notices) {
            tenders.push(mapFaTNotice(n));
          }
        }
      } catch {
        continue;
      }
    }
  }

  return tenders;
}

function mapFaTNotice(n: Record<string, unknown>): RawTender {
  const id = String(n.id || n.noticeId || n.ocid || "");
  const title = String(n.title || n.name || "");
  const description = String(n.description || n.summary || "");
  const publishedDate = String(n.publishedDate || n.datePublished || "");
  const deadlineDate = n.deadlineDate || n.submissionDeadline || null;
  const valueObj = (n.value || n.estimatedValue || {}) as Record<string, unknown>;
  const value =
    typeof valueObj === "object" && valueObj !== null
      ? Number(valueObj.amount || valueObj.max || 0) || null
      : typeof n.value === "number"
        ? n.value
        : null;
  const buyer = String(
    (n.buyer as Record<string, unknown>)?.name ||
      n.organisationName ||
      n.buyer ||
      ""
  );
  const location = String(
    n.region || n.location || n.placeOfPerformance || ""
  );
  const cpvCodes = Array.isArray(n.cpvCodes)
    ? n.cpvCodes.map(String)
    : typeof n.cpvCodes === "string"
      ? [n.cpvCodes]
      : [];

  return {
    id: `fat-${id}`,
    title,
    description,
    publishedDate,
    deadlineDate: deadlineDate ? String(deadlineDate) : null,
    value,
    currency: "GBP",
    buyer,
    location,
    source: "find-a-tender",
    url: `https://www.find-tender.service.gov.uk/Notice/${id}`,
    cpvCodes,
  };
}

// ── Contracts Finder ──────────────────────────────────────────────────

async function fetchContractsFinder(days: number): Promise<RawTender[]> {
  const since = daysAgoISO(days);
  const tenders: RawTender[] = [];

  // CPV code search
  const cpvUrl =
    `https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?` +
    `cpvCodes=${CPV_ELECTRICITY}&publishedFrom=${since}&size=100`;

  try {
    const res = await fetch(cpvUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = await res.json();
      const releases = data.releases || data.results || [];
      for (const r of releases) {
        tenders.push(mapCfRelease(r));
      }
    }
  } catch {
    // fall through to keyword fallback
  }

  // Keyword fallback
  if (tenders.length === 0) {
    for (const keyword of KEYWORD_FALLBACKS) {
      const kwUrl =
        `https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?` +
        `q=${encodeURIComponent(keyword)}&publishedFrom=${since}&size=50`;
      try {
        const res = await fetch(kwUrl, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const data = await res.json();
          const releases = data.releases || data.results || [];
          for (const r of releases) {
            tenders.push(mapCfRelease(r));
          }
        }
      } catch {
        continue;
      }
    }
  }

  return tenders;
}

function mapCfRelease(r: Record<string, unknown>): RawTender {
  const tender = (r.tender || {}) as Record<string, unknown>;
  const buyer = (r.buyer || {}) as Record<string, unknown>;
  const ocid = String(r.ocid || r.id || "");
  const title = String(tender.title || r.title || "");
  const description = String(tender.description || r.description || "");
  const datePublished = String(r.datePublished || r.publishedDate || "");
  const deadlineDate = tender.tenderPeriod
    ? String(
        (tender.tenderPeriod as Record<string, unknown>).endDate || ""
      )
    : null;
  const valueObj = (tender.value || {}) as Record<string, unknown>;
  const value = Number(valueObj.amount || 0) || null;
  const items = Array.isArray(tender.items) ? tender.items : [];
  const cpvCodes: string[] = [];
  for (const item of items) {
    const classification = (item as Record<string, unknown>)
      .classification as Record<string, unknown> | undefined;
    if (classification?.id) cpvCodes.push(String(classification.id));
  }

  return {
    id: `cf-${ocid}`,
    title,
    description,
    publishedDate: datePublished,
    deadlineDate: deadlineDate || null,
    value,
    currency: "GBP",
    buyer: String(buyer.name || ""),
    location: String(
      (tender.deliveryAddresses as Record<string, unknown>[])?.[0]?.region ||
        tender.region ||
        ""
    ),
    source: "contracts-finder",
    url: `https://www.contractsfinder.service.gov.uk/Notice/${ocid}`,
    cpvCodes,
  };
}

// ── Deduplication & Export ─────────────────────────────────────────────

function dedup(tenders: RawTender[]): RawTender[] {
  const seen = new Map<string, RawTender>();

  for (const t of tenders) {
    // Deduplicate by normalised title + buyer
    const key = `${t.title.toLowerCase().trim()}|${t.buyer.toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.set(key, t);
    }
  }

  return Array.from(seen.values());
}

export async function collectTenders(days: number): Promise<RawTender[]> {
  const [fatResults, cfResults] = await Promise.allSettled([
    fetchFindATender(days),
    fetchContractsFinder(days),
  ]);

  const all: RawTender[] = [
    ...(fatResults.status === "fulfilled" ? fatResults.value : []),
    ...(cfResults.status === "fulfilled" ? cfResults.value : []),
  ];

  return dedup(all);
}
