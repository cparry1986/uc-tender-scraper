import {
  TrackedFramework,
  FrameworkSignal,
  FrameworkStatus,
  ContractExpiry,
  FrameworkIntelligence,
} from "./types";

// ── Known Framework Definitions ──────────────────────────────────────

const KNOWN_FRAMEWORKS: Omit<TrackedFramework, "ftsSignals" | "currentStatus">[] = [
  {
    id: "ccs-rm6390",
    name: "CCS Supply of Energy 3 (RM6390)",
    operator: "Crown Commercial Service",
    reference: "RM6390",
    description:
      "The single biggest UK electricity supply framework. ~26 TWh of electricity and gas across 1,000+ customers and ~90,000 meters. Replaces RM6251.",
    estimatedValue: "£51bn",
    expiryDate: null,
    nextProcurementWindow: "2025-2026",
    relevance:
      "Critical — getting on this framework gives access to central government and wider public sector call-offs.",
    actionRequired:
      "Engage with CCS market engagement events NOW. Submit PQQ/tender when published.",
    tier: "critical",
  },
  {
    id: "laser-y22009",
    name: "LASER Flexible Electricity Framework (Y22009)",
    operator: "LASER Energy (Kent County Council)",
    reference: "Y22009",
    description:
      "One of the largest energy buying organisations in the UK, purchasing over £450m of energy per annum for 200+ public sector customers. Permits Direct Award.",
    estimatedValue: "£450m/year",
    expiryDate: "2028-09-30",
    nextProcurementWindow: "2027-2028",
    relevance:
      "High — Direct Award route means lower competition. 200+ public sector customers.",
    actionRequired:
      "Apply to join the framework. Monitor for lot extensions and new call-offs.",
    tier: "critical",
  },
  {
    id: "nepo-electricity",
    name: "NEPO Electricity Framework",
    operator: "North East Procurement Organisation",
    reference: "NEPO-ELEC",
    description:
      "Award-winning electricity framework for North East local authorities. Extended for a further two years. Dedicated Energy Leads team.",
    estimatedValue: "£200m+",
    expiryDate: null,
    nextProcurementWindow: "2026-2027",
    relevance:
      "High — North East geographic coverage, strong reference customer base.",
    actionRequired:
      "Monitor NEPO portal for re-procurement. Register on NEPO Open platform.",
    tier: "high",
  },
  {
    id: "tec-gen6",
    name: "TEC 6th Generation Flexible Energy",
    operator: "The Energy Consortium",
    reference: "TEC-GEN6",
    description:
      "144 HE members representing 72% of UK universities. Current contract awarded to EDF and Corona Energy (Oct 2024 start).",
    estimatedValue: "£300m+",
    expiryDate: "2026-09-30",
    nextProcurementWindow: "2026",
    relevance:
      "High — Universities are strong reference customers. 144 members = massive volume.",
    actionRequired:
      "Monitor for Gen 7 re-procurement. Engage with TEC procurement team early.",
    tier: "high",
  },
  {
    id: "pfh-energy",
    name: "PfH Energy Framework",
    operator: "Procurement for Housing",
    reference: "PFH-ENERGY",
    description:
      "UK's leading procurement partner for social housing sector. 1,100+ members including housing associations, local authorities, ALMOs. HQ in North West.",
    estimatedValue: "£150m+",
    expiryDate: null,
    nextProcurementWindow: "2026-2027",
    relevance:
      "High — Housing associations are a key buyer type. PfH is HQ'd in NW England.",
    actionRequired:
      "Register with PfH. Monitor for framework re-procurement on FTS.",
    tier: "high",
  },
  {
    id: "ypo-energy",
    name: "YPO Energy & Utilities",
    operator: "Yorkshire Purchasing Organisation",
    reference: "YPO-ENERGY",
    description:
      "Yorkshire-based but works nationally. Public sector energy and utilities procurement support.",
    estimatedValue: "£100m+",
    expiryDate: null,
    nextProcurementWindow: null,
    relevance:
      "Medium — National reach from Yorkshire base. Complementary to NEPO for northern coverage.",
    actionRequired: "Monitor YPO website for energy framework opportunities.",
    tier: "medium",
  },
  {
    id: "espo-energy",
    name: "ESPO Energy (via LASER)",
    operator: "Eastern Shires Purchasing Organisation",
    reference: "ESPO-ENERGY",
    description:
      "Owned by 6 county councils (Cambs, Leics, Lincs, Norfolk, Peterborough, Warwickshire). Currently buys energy through LASER frameworks.",
    estimatedValue: "£80m+",
    expiryDate: null,
    nextProcurementWindow: null,
    relevance:
      "Medium — Being on LASER framework gives indirect access to ESPO customers.",
    actionRequired:
      "Covered by LASER framework participation. Monitor for independent procurement.",
    tier: "medium",
  },
  {
    id: "nhs-centralised",
    name: "NHS Centralised Energy Purchasing",
    operator: "NHS England (via CCS)",
    reference: "NHS-ENERGY",
    description:
      "NHS standardising energy procurement including REGOs across all trusts. Being centralised through CCS frameworks. Some trusts still procure independently.",
    estimatedValue: "£500m+",
    expiryDate: null,
    nextProcurementWindow: null,
    relevance:
      "Critical — NHS trusts are high-value, high-volume customers. Covered partly by CCS RM6390.",
    actionRequired:
      "Get on CCS framework. Monitor individual NHS trust tenders on FTS for independent procurements.",
    tier: "critical",
  },
];

// ── FTS Signal Detection ─────────────────────────────────────────────

const FRAMEWORK_SEARCH_TERMS: Record<string, string[]> = {
  "ccs-rm6390": ["RM6390", "Supply of Energy 3", "RM6251", "CCS energy framework"],
  "laser-y22009": ["LASER energy", "Y22009", "LASER electricity", "Kent County Council energy"],
  "nepo-electricity": ["NEPO electricity", "NEPO energy", "North East Procurement Organisation energy"],
  "tec-gen6": ["Energy Consortium", "TEC energy", "TEC electricity", "university energy framework"],
  "pfh-energy": ["Procurement for Housing energy", "PfH energy", "social housing energy"],
  "ypo-energy": ["YPO energy", "Yorkshire Purchasing Organisation energy"],
  "espo-energy": ["ESPO energy", "Eastern Shires energy"],
  "nhs-centralised": ["NHS energy", "NHS electricity", "NHS SBS energy"],
};

async function fetchFrameworkSignals(): Promise<Map<string, FrameworkSignal[]>> {
  const signalMap = new Map<string, FrameworkSignal[]>();

  for (const [frameworkId, terms] of Object.entries(FRAMEWORK_SEARCH_TERMS)) {
    const signals: FrameworkSignal[] = [];

    for (const term of terms.slice(0, 2)) {
      try {
        const url =
          `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?` +
          `keyword=${encodeURIComponent(term)}&size=10`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) continue;

        const data = await res.json();
        const packages = data.results || data.releases || data.releasePackages || [];
        for (const pkg of packages) {
          const releases = pkg.releases || [pkg];
          for (const r of releases) {
            const tender = (r.tender || {}) as Record<string, unknown>;
            const title = String(tender.title || r.title || "");
            const datePublished = String(r.datePublished || r.date || "");
            const ocid = String(r.ocid || r.id || pkg?.ocid || "");
            const noticeId = ocid.replace(/^ocds-[a-z0-9]+-/i, "");
            const tag = Array.isArray(r.tag) ? r.tag[0] : "";

            let signalType: FrameworkSignal["type"] = "pipeline";
            if (/market\s+engagement|PIN|prior\s+information/i.test(title))
              signalType = "market-engagement";
            else if (/award/i.test(tag) || /award/i.test(title))
              signalType = "award";
            else if (/expir|renew|re-?procur/i.test(title))
              signalType = "re-procurement";

            signals.push({
              title,
              url: `https://www.find-tender.service.gov.uk/Notice/${noticeId}`,
              date: datePublished,
              type: signalType,
            });
          }
        }
      } catch {
        continue;
      }
    }

    signalMap.set(frameworkId, signals.slice(0, 5));
  }

  return signalMap;
}

// ── Contract Expiry Scraping ─────────────────────────────────────────

async function fetchContractExpiries(): Promise<ContractExpiry[]> {
  const expiries: ContractExpiry[] = [];

  // Fetch award notices from FTS for electricity contracts
  const searchTerms = [
    "electricity supply",
    "energy supply",
    "electricity framework",
  ];

  for (const term of searchTerms) {
    try {
      const url =
        `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?` +
        `keyword=${encodeURIComponent(term)}&stage=award&size=50`;
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
          const awards = Array.isArray(r.awards) ? r.awards : [];
          const buyer = (r.buyer || pkg?.buyer || {}) as Record<string, unknown>;
          const tender = (r.tender || {}) as Record<string, unknown>;
          const ocid = String(r.ocid || r.id || pkg?.ocid || "");
          const title = String(tender.title || r.title || "");
          const noticeId = ocid.replace(/^ocds-[a-z0-9]+-/i, "");

          for (const award of awards) {
            const a = award as Record<string, unknown>;
            const awardDate = String(a.date || r.datePublished || "");
            const contractPeriod = (a.contractPeriod || {}) as Record<string, unknown>;
            const endDate = contractPeriod.endDate
              ? String(contractPeriod.endDate)
              : null;
            const valueObj = (a.value || {}) as Record<string, unknown>;
            const value = Number(valueObj.amount || 0) || null;

            // Estimate expiry if not given (assume 4-year contracts)
            let estimatedExpiry: string | null = null;
            if (!endDate && awardDate) {
              try {
                const awarded = new Date(awardDate);
                awarded.setFullYear(awarded.getFullYear() + 4);
                estimatedExpiry = awarded.toISOString().split("T")[0];
              } catch {
                // skip
              }
            }

            const expiryStr = endDate || estimatedExpiry;
            let daysUntilExpiry: number | null = null;
            if (expiryStr) {
              daysUntilExpiry = Math.ceil(
                (new Date(expiryStr).getTime() - Date.now()) / 86400000
              );
            }

            // Extract region from delivery addresses
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

            expiries.push({
              id: `expiry-${ocid}-${String(a.id || "")}`,
              title,
              buyer: String(buyer.name || ""),
              value,
              awardDate,
              expiryDate: endDate,
              estimatedExpiryDate: estimatedExpiry,
              region: location,
              source: "find-a-tender",
              url: `https://www.find-tender.service.gov.uk/Notice/${noticeId}`,
              daysUntilExpiry,
            });
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Deduplicate and sort by expiry date
  const seen = new Set<string>();
  const unique = expiries.filter((e) => {
    const key = `${e.title.toLowerCase()}|${e.buyer.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique
    .filter((e) => e.daysUntilExpiry !== null)
    .sort((a, b) => (a.daysUntilExpiry || 0) - (b.daysUntilExpiry || 0));
}

// ── Status Detection ─────────────────────────────────────────────────

function detectStatus(
  framework: Omit<TrackedFramework, "ftsSignals" | "currentStatus">,
  signals: FrameworkSignal[]
): FrameworkStatus {
  // Check signals for re-procurement activity
  const hasReprocurement = signals.some(
    (s) => s.type === "re-procurement" || s.type === "market-engagement"
  );
  if (hasReprocurement) return "re-procuring";

  // Check expiry date
  if (framework.expiryDate) {
    const daysUntil = Math.ceil(
      (new Date(framework.expiryDate).getTime() - Date.now()) / 86400000
    );
    if (daysUntil < 0) return "expired";
    if (daysUntil <= 365) return "expiring-soon";
  }

  // Check procurement window
  if (framework.nextProcurementWindow) {
    const currentYear = new Date().getFullYear();
    const windowYear = parseInt(framework.nextProcurementWindow);
    if (!isNaN(windowYear) && windowYear <= currentYear) return "re-procuring";
    if (
      !isNaN(windowYear) &&
      windowYear === currentYear + 1
    )
      return "expiring-soon";
  }

  return "active";
}

// ── Public API ─────────────────────────────────────────────────────────

export async function getFrameworkIntelligence(): Promise<FrameworkIntelligence> {
  const [signalMap, contractExpiries] = await Promise.all([
    fetchFrameworkSignals(),
    fetchContractExpiries(),
  ]);

  const frameworks: TrackedFramework[] = KNOWN_FRAMEWORKS.map((fw) => {
    const signals = signalMap.get(fw.id) || [];
    const currentStatus = detectStatus(fw, signals);
    return { ...fw, ftsSignals: signals, currentStatus };
  });

  const expiringNext6Months = contractExpiries.filter(
    (e) => e.daysUntilExpiry !== null && e.daysUntilExpiry > 0 && e.daysUntilExpiry <= 180
  ).length;

  const upcomingReprocurements = frameworks.filter(
    (f) => f.currentStatus === "re-procuring" || f.currentStatus === "expiring-soon"
  ).length;

  return {
    frameworks,
    contractExpiries: contractExpiries.slice(0, 50),
    upcomingReprocurements,
    expiringNext6Months,
    totalFrameworkValue: "£52bn+",
  };
}
