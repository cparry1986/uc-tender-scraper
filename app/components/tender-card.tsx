"use client";

import { ScoredTender } from "@/lib/types";

function formatVal(v: number | null): string {
  if (!v) return "Undisclosed";
  if (v >= 1_000_000) return `\u00A3${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `\u00A3${(v / 1_000).toFixed(0)}k`;
  return `\u00A3${v}`;
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return "No deadline";
  const days = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / 86400000
  );
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d left`;
}

function deadlineColor(dateStr: string | null): string {
  if (!dateStr) return "text-slate-500";
  const days = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / 86400000
  );
  if (days < 0) return "text-red-400";
  if (days <= 7) return "text-red-400";
  if (days <= 14) return "text-uc-yellow";
  return "text-slate-400";
}

const EFFORT_STYLES: Record<string, string> = {
  Low: "bg-uc-teal/10 text-uc-teal",
  Medium: "bg-yellow-500/10 text-yellow-400",
  High: "bg-red-500/10 text-red-400",
};

const DIMENSION_COLORS = [
  { key: "fit" as const, label: "Fit", max: 30, color: "#00DCBC" },
  { key: "value" as const, label: "Value", max: 20, color: "#00378E" },
  { key: "timeline" as const, label: "Time", max: 15, color: "#FDE100" },
  { key: "winProbability" as const, label: "Win", max: 20, color: "#8B5CF6" },
  { key: "geography" as const, label: "Geo", max: 10, color: "#F59E0B" },
  { key: "strategic" as const, label: "Strat", max: 5, color: "#EC4899" },
];

function ScoreStackedBar({ score }: { score: ScoredTender["score"] }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-2 rounded-full overflow-hidden flex-1 bg-slate-800">
        {DIMENSION_COLORS.map((dim) => {
          const pct = (score[dim.key] / dim.max) * (dim.max);
          return (
            <div
              key={dim.key}
              style={{
                width: `${pct}%`,
                backgroundColor: dim.color,
                minWidth: score[dim.key] > 0 ? "2px" : "0",
              }}
              title={`${dim.label}: ${score[dim.key]}/${dim.max}`}
            />
          );
        })}
      </div>
      <span className="text-xs font-bold text-white w-8 text-right">
        {score.total}
      </span>
    </div>
  );
}

export default function TenderCard({
  tender,
  expanded,
  onToggle,
}: {
  tender: ScoredTender;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = tender;

  return (
    <div className="glass-card-hover mb-3 overflow-hidden">
      {/* Header — always visible */}
      <div
        onClick={onToggle}
        className="p-4 cursor-pointer select-none"
      >
        {/* Top row: badges */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              t.priority === "HIGH"
                ? "bg-uc-teal/20 text-uc-teal"
                : t.priority === "MEDIUM"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-slate-600/30 text-slate-400"
            }`}
          >
            {t.priority}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${EFFORT_STYLES[t.effortEstimate] || ""}`}
          >
            {t.effortEstimate} Effort
          </span>
          {t.isPipeline && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 border-dashed">
              UPCOMING
            </span>
          )}
          <span className="text-[10px] text-slate-600">
            {t.source === "find-a-tender"
              ? "Find a Tender"
              : t.source === "bidstats"
                ? "Bidstats"
                : "Contracts Finder"}
          </span>
          {t.procurementRoute !== "Not Specified" && (
            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
              {t.procurementRoute}
            </span>
          )}
          <span className="ml-auto text-slate-600 text-xs">{expanded ? "\u25B2" : "\u25BC"}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-heading font-semibold text-slate-200 leading-snug mb-2">
          {t.title}
        </h3>

        {/* Recommendation Why */}
        <p className="text-xs text-uc-teal/80 leading-relaxed mb-3 border-l-2 border-uc-teal/30 pl-3">
          {t.recommendationWhy}
        </p>

        {/* Score bar */}
        <ScoreStackedBar score={t.score} />

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-400">
          <span>{t.buyer || "Unknown buyer"}</span>
          <span className="font-medium text-slate-300">
            {formatVal(t.value)}
          </span>
          <span className={deadlineColor(t.deadlineDate)}>
            {daysUntil(t.deadlineDate)}
          </span>
          <span>{t.region}</span>
          {t.buyerType !== "Other Public Sector" && (
            <span className="text-uc-purple">{t.buyerType}</span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.04]">
          {/* Score breakdown grid */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 my-4">
            {DIMENSION_COLORS.map((dim) => {
              const val = t.score[dim.key];
              const pct = Math.round((val / dim.max) * 100);
              return (
                <div key={dim.key}>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>{dim.label}</span>
                    <span>
                      {val}/{dim.max}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: dim.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Description */}
          {t.description && (
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              {t.description.length > 600
                ? t.description.slice(0, 600) + "..."
                : t.description}
            </p>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-4">
            <div>
              <span className="text-slate-600">Location:</span>{" "}
              {t.location || "Not specified"}
            </div>
            <div>
              <span className="text-slate-600">Published:</span>{" "}
              {t.publishedDate
                ? new Date(t.publishedDate).toLocaleDateString("en-GB")
                : "Unknown"}
            </div>
            <div>
              <span className="text-slate-600">CPV:</span>{" "}
              {t.cpvCodes.length > 0 ? t.cpvCodes.join(", ") : "None"}
            </div>
            <div>
              <span className="text-slate-600">ID:</span> {t.id}
            </div>
          </div>

          <a
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-uc-navy hover:bg-uc-navy/80 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            View on{" "}
            {t.source === "find-a-tender"
              ? "Find a Tender"
              : t.source === "bidstats"
                ? "Bidstats"
                : "Contracts Finder"}{" "}
            &#8599;
          </a>
        </div>
      )}
    </div>
  );
}
