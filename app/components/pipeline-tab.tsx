"use client";

import { useState } from "react";
import { ScoredTender, ScrapeResult } from "@/lib/types";
import HeroStats from "./hero-stats";
import FilterBar, { Filters, DEFAULT_FILTERS, applyFilters } from "./filter-bar";
import TenderCard from "./tender-card";

export default function PipelineTab({ result }: { result: ScrapeResult }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showLow, setShowLow] = useState(false);

  const filtered = applyFilters(result.tenders, filters);

  const high = filtered.filter((t) => t.priority === "HIGH");
  const medium = filtered.filter((t) => t.priority === "MEDIUM");
  const low = filtered.filter((t) => t.priority === "LOW");

  const isFiltered =
    JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div>
      <HeroStats stats={result.stats} />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        tenders={result.tenders}
      />

      {/* Sections */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg mb-2">No tenders match your filters</p>
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-uc-teal text-sm hover:underline"
          >
            Reset filters
          </button>
        </div>
      )}

      {high.length > 0 && (
        <Section
          icon="&#128293;"
          title="Recommended to Bid"
          count={high.length}
          color="text-uc-teal"
          borderColor="border-uc-teal/30"
        >
          {high.map((t) => (
            <TenderCard
              key={t.id}
              tender={t}
              expanded={expandedId === t.id}
              onToggle={() =>
                setExpandedId(expandedId === t.id ? null : t.id)
              }
            />
          ))}
        </Section>
      )}

      {medium.length > 0 && (
        <Section
          icon="&#128064;"
          title="Worth Monitoring"
          count={medium.length}
          color="text-yellow-400"
          borderColor="border-yellow-500/30"
        >
          {medium.map((t) => (
            <TenderCard
              key={t.id}
              tender={t}
              expanded={expandedId === t.id}
              onToggle={() =>
                setExpandedId(expandedId === t.id ? null : t.id)
              }
            />
          ))}
        </Section>
      )}

      {low.length > 0 && (
        <Section
          icon="&#128203;"
          title="Other"
          count={low.length}
          color="text-slate-400"
          borderColor="border-slate-600/30"
          collapsed={!isFiltered && !showLow}
          onToggle={() => setShowLow(!showLow)}
        >
          {low.map((t) => (
            <TenderCard
              key={t.id}
              tender={t}
              expanded={expandedId === t.id}
              onToggle={() =>
                setExpandedId(expandedId === t.id ? null : t.id)
              }
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  color,
  borderColor,
  collapsed,
  onToggle,
  children,
}: {
  icon: string;
  title: string;
  count: number;
  color: string;
  borderColor: string;
  collapsed?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div
        className={`flex items-center gap-2 mb-4 pb-2 border-b ${borderColor} ${onToggle ? "cursor-pointer select-none" : ""}`}
        onClick={onToggle}
      >
        <span dangerouslySetInnerHTML={{ __html: icon }} />
        <h2 className={`font-heading font-bold text-base ${color}`}>
          {title}
        </h2>
        <span className="text-xs text-slate-500 ml-1">({count})</span>
        {onToggle && (
          <span className="ml-auto text-xs text-slate-500">
            {collapsed ? "Show \u25BC" : "Hide \u25B2"}
          </span>
        )}
      </div>
      {!collapsed && children}
    </div>
  );
}
