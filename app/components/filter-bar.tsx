"use client";

import { ScoredTender } from "@/lib/types";

export interface Filters {
  priority: string;
  region: string;
  procurementRoute: string;
  valueRange: string;
  deadlineRange: string;
  search: string;
}

export const DEFAULT_FILTERS: Filters = {
  priority: "all",
  region: "all",
  procurementRoute: "all",
  valueRange: "all",
  deadlineRange: "all",
  search: "",
};

export function applyFilters(
  tenders: ScoredTender[],
  filters: Filters
): ScoredTender[] {
  return tenders.filter((t) => {
    if (t.excluded) return false;

    if (filters.priority !== "all" && t.priority !== filters.priority)
      return false;

    if (filters.region !== "all" && t.region !== filters.region) return false;

    if (
      filters.procurementRoute !== "all" &&
      t.procurementRoute !== filters.procurementRoute
    )
      return false;

    if (filters.valueRange !== "all") {
      const v = t.value || 0;
      switch (filters.valueRange) {
        case "under-100k":
          if (v >= 100_000 || v === 0) return false;
          break;
        case "100k-500k":
          if (v < 100_000 || v >= 500_000) return false;
          break;
        case "500k-2m":
          if (v < 500_000 || v >= 2_000_000) return false;
          break;
        case "2m-5m":
          if (v < 2_000_000 || v >= 5_000_000) return false;
          break;
        case "5m-plus":
          if (v < 5_000_000) return false;
          break;
      }
    }

    if (filters.deadlineRange !== "all" && t.deadlineDate) {
      const daysLeft = Math.ceil(
        (new Date(t.deadlineDate).getTime() - Date.now()) / 86400000
      );
      switch (filters.deadlineRange) {
        case "this-week":
          if (daysLeft < 0 || daysLeft > 7) return false;
          break;
        case "next-2-weeks":
          if (daysLeft < 0 || daysLeft > 14) return false;
          break;
        case "next-month":
          if (daysLeft < 0 || daysLeft > 30) return false;
          break;
        case "next-3-months":
          if (daysLeft < 0 || daysLeft > 90) return false;
          break;
      }
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      const text =
        `${t.title} ${t.buyer} ${t.description} ${t.region}`.toLowerCase();
      if (!text.includes(q)) return false;
    }

    return true;
  });
}

function uniqueValues(tenders: ScoredTender[], key: keyof ScoredTender): string[] {
  const set = new Set<string>();
  for (const t of tenders) {
    if (!t.excluded) set.add(String(t[key]));
  }
  return Array.from(set).sort();
}

const selectClass =
  "bg-uc-surface border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-uc-teal/50 transition-colors";

export default function FilterBar({
  filters,
  onChange,
  tenders,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  tenders: ScoredTender[];
}) {
  const regions = uniqueValues(tenders, "region");
  const routes = uniqueValues(tenders, "procurementRoute");

  return (
    <div className="glass-card p-4 mb-6 opacity-0 animate-fade-in-up stagger-2">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <input
          type="text"
          placeholder="Search tenders..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="bg-uc-surface border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-slate-300 w-48 focus:outline-none focus:border-uc-teal/50 transition-colors placeholder:text-slate-600"
        />

        {/* Priority */}
        <select
          value={filters.priority}
          onChange={(e) => onChange({ ...filters, priority: e.target.value })}
          className={selectClass}
        >
          <option value="all">All Priorities</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>

        {/* Region */}
        <select
          value={filters.region}
          onChange={(e) => onChange({ ...filters, region: e.target.value })}
          className={selectClass}
        >
          <option value="all">All Regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {/* Procurement Route */}
        <select
          value={filters.procurementRoute}
          onChange={(e) =>
            onChange({ ...filters, procurementRoute: e.target.value })
          }
          className={selectClass}
        >
          <option value="all">All Routes</option>
          {routes.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {/* Value Range */}
        <select
          value={filters.valueRange}
          onChange={(e) => onChange({ ...filters, valueRange: e.target.value })}
          className={selectClass}
        >
          <option value="all">All Values</option>
          <option value="under-100k">Under £100k</option>
          <option value="100k-500k">£100k - £500k</option>
          <option value="500k-2m">£500k - £2m</option>
          <option value="2m-5m">£2m - £5m</option>
          <option value="5m-plus">£5m+</option>
        </select>

        {/* Deadline Range */}
        <select
          value={filters.deadlineRange}
          onChange={(e) =>
            onChange({ ...filters, deadlineRange: e.target.value })
          }
          className={selectClass}
        >
          <option value="all">All Deadlines</option>
          <option value="this-week">This week</option>
          <option value="next-2-weeks">Next 2 weeks</option>
          <option value="next-month">Next month</option>
          <option value="next-3-months">Next 3 months</option>
        </select>

        {/* Reset */}
        {JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-xs text-slate-500 hover:text-uc-teal transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
