"use client";

import { useState } from "react";
import { ScoredTender, ScrapeResult, AwardNotice } from "@/lib/types";
import HeroStats from "./hero-stats";
import FilterBar, { Filters, DEFAULT_FILTERS, applyFilters } from "./filter-bar";
import TenderCard from "./tender-card";

export default function PipelineTab({ result }: { result: ScrapeResult }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showLow, setShowLow] = useState(false);
  const [showPipeline, setShowPipeline] = useState(true);
  const [showAwards, setShowAwards] = useState(false);

  const filtered = applyFilters(result.tenders, filters);
  const pipelineTenders = filtered.filter((t) => t.isPipeline);
  const activeTenders = filtered.filter((t) => !t.isPipeline);

  const high = activeTenders.filter((t) => t.priority === "HIGH");
  const medium = activeTenders.filter((t) => t.priority === "MEDIUM");
  const low = activeTenders.filter((t) => t.priority === "LOW");

  const isFiltered =
    JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div>
      <HeroStats stats={result.stats} sourceHealth={result.sourceHealth} />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        tenders={result.tenders}
      />

      {/* Pipeline Intelligence Section */}
      {pipelineTenders.length > 0 && (
        <div className="mb-8">
          <div
            className="flex items-center gap-2 mb-4 pb-2 border-b border-purple-500/30 cursor-pointer select-none"
            onClick={() => setShowPipeline(!showPipeline)}
          >
            <span>&#128225;</span>
            <h2 className="font-heading font-bold text-base text-purple-300">
              Pipeline Intelligence
            </h2>
            <span className="text-xs text-slate-500 ml-1">
              ({pipelineTenders.length})
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 border-dashed ml-2">
              UPCOMING
            </span>
            <span className="ml-auto text-xs text-slate-500">
              {showPipeline ? "\u25B2" : "\u25BC"}
            </span>
          </div>
          {showPipeline && (
            <div className="border border-purple-500/20 border-dashed rounded-xl p-4 bg-purple-900/5">
              <p className="text-xs text-slate-500 mb-4">
                Early-stage planning notices — monitor these for when they move to active tender stage.
              </p>
              {pipelineTenders.map((t) => (
                <TenderCard
                  key={t.id}
                  tender={t}
                  expanded={expandedId === t.id}
                  onToggle={() =>
                    setExpandedId(expandedId === t.id ? null : t.id)
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Market Intelligence */}
      {result.recentAwards && result.recentAwards.length > 0 && (
        <div className="mb-8">
          <div
            className="flex items-center gap-2 mb-4 pb-2 border-b border-uc-navy/30 cursor-pointer select-none"
            onClick={() => setShowAwards(!showAwards)}
          >
            <span>&#127942;</span>
            <h2 className="font-heading font-bold text-base text-slate-200">
              Market Intelligence
            </h2>
            <span className="text-xs text-slate-500 ml-1">
              ({result.recentAwards.length} awards)
            </span>
            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded ml-1">
              Competitor &amp; buyer intelligence
            </span>
            <span className="ml-auto text-xs text-slate-500">
              {showAwards ? "\u25B2" : "\u25BC"}
            </span>
          </div>
          {showAwards && (
            <div className="space-y-4">
              <CompetitorAnalysis awards={result.recentAwards} />
              <BuyerActivity awards={result.recentAwards} />
              <div className="glass-card p-4">
                <h3 className="text-xs font-semibold text-slate-300 mb-3">
                  All Recent Awards
                </h3>
                {result.recentAwards.slice(0, 40).map((a, i) => (
                  <AwardRow key={i} award={a} />
                ))}
                {result.recentAwards.length > 40 && (
                  <p className="text-[10px] text-slate-600 text-center mt-2">
                    + {result.recentAwards.length - 40} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Market Intelligence Components ────────────────────────────────────

interface CompetitorStat {
  name: string;
  wins: number;
  totalValue: number;
}

function CompetitorAnalysis({ awards }: { awards: AwardNotice[] }) {
  const competitors = new Map<string, { wins: number; totalValue: number }>();
  for (const a of awards) {
    if (!a.winner || a.winner === "Unknown") continue;
    const existing = competitors.get(a.winner) || { wins: 0, totalValue: 0 };
    existing.wins++;
    existing.totalValue += a.value || 0;
    competitors.set(a.winner, existing);
  }

  const sorted: CompetitorStat[] = Array.from(competitors.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 10);

  if (sorted.length === 0) return null;

  const maxWins = sorted[0]?.wins || 1;

  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-semibold text-slate-300 mb-1">
        Top Competitors by Wins
      </h3>
      <p className="text-[10px] text-slate-600 mb-3">
        Who is winning electricity supply contracts — know your competition
      </p>
      <div className="space-y-2">
        {sorted.map((c) => (
          <div key={c.name} className="flex items-center gap-3">
            <div className="w-36 text-[11px] text-slate-300 truncate shrink-0" title={c.name}>
              {c.name}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-uc-navy to-uc-teal/60"
                  style={{ width: `${(c.wins / maxWins) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 w-8 text-right">
                {c.wins}
              </span>
              <span className="text-[10px] text-uc-teal w-16 text-right">
                {formatAwardVal(c.totalValue)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BuyerStat {
  name: string;
  contracts: number;
  totalValue: number;
  lastAward: string;
  winners: string[];
}

function BuyerActivity({ awards }: { awards: AwardNotice[] }) {
  const buyers = new Map<
    string,
    { contracts: number; totalValue: number; lastAward: string; winners: Set<string> }
  >();
  for (const a of awards) {
    if (!a.buyer) continue;
    const existing = buyers.get(a.buyer) || {
      contracts: 0,
      totalValue: 0,
      lastAward: "",
      winners: new Set<string>(),
    };
    existing.contracts++;
    existing.totalValue += a.value || 0;
    if (a.awardDate > existing.lastAward) existing.lastAward = a.awardDate;
    if (a.winner && a.winner !== "Unknown") existing.winners.add(a.winner);
    buyers.set(a.buyer, existing);
  }

  const sorted: BuyerStat[] = Array.from(buyers.entries())
    .map(([name, data]) => ({
      name,
      contracts: data.contracts,
      totalValue: data.totalValue,
      lastAward: data.lastAward,
      winners: Array.from(data.winners),
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 10);

  if (sorted.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-semibold text-slate-300 mb-1">
        Most Active Buyers
      </h3>
      <p className="text-[10px] text-slate-600 mb-3">
        Buyers with recent electricity supply awards — potential re-tender targets
      </p>
      <div className="space-y-2.5">
        {sorted.map((b) => (
          <div
            key={b.name}
            className="flex items-start gap-3 py-2 border-b border-white/[0.03] last:border-0"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-300 font-medium truncate">
                {b.name}
              </div>
              <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-3 mt-0.5">
                <span>{b.contracts} award{b.contracts > 1 ? "s" : ""}</span>
                {b.lastAward && (
                  <span>
                    Last: {new Date(b.lastAward).toLocaleDateString("en-GB")}
                  </span>
                )}
                {b.winners.length > 0 && (
                  <span className="text-uc-teal/70">
                    Won by: {b.winners.slice(0, 2).join(", ")}
                    {b.winners.length > 2 ? ` +${b.winners.length - 2}` : ""}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-semibold text-uc-teal">
                {formatAwardVal(b.totalValue)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAwardVal(v: number | null): string {
  if (!v) return "Undisclosed";
  if (v >= 1_000_000) return `\u00A3${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `\u00A3${(v / 1_000).toFixed(0)}k`;
  return `\u00A3${v}`;
}

function AwardRow({ award }: { award: AwardNotice }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.03] last:border-0">
      <div className="flex-1 min-w-0">
        <a
          href={award.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-300 hover:text-uc-teal transition-colors leading-snug block truncate"
        >
          {award.title}
        </a>
        <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-3 mt-0.5">
          <span>{award.buyer || "Unknown buyer"}</span>
          {award.region && <span>{award.region}</span>}
          {award.awardDate && (
            <span>
              {new Date(award.awardDate).toLocaleDateString("en-GB")}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-semibold text-uc-teal">
          {award.winner}
        </div>
        <div className="text-[10px] text-slate-500">
          {formatAwardVal(award.value)}
        </div>
      </div>
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
