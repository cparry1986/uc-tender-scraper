"use client";

import { ScrapeResult } from "@/lib/types";

function formatValue(v: number): string {
  if (v >= 1_000_000) return `\u00A3${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `\u00A3${(v / 1_000).toFixed(0)}k`;
  return `\u00A3${v}`;
}

export default function HeroStats({ stats }: { stats: ScrapeResult["stats"] }) {
  const cards = [
    {
      label: "Opportunities",
      value: String(stats.totalFound),
      sub: `${stats.afterExclusions} eligible`,
      color: "text-white",
      border: "border-slate-600",
    },
    {
      label: "Pipeline Value",
      value: formatValue(stats.pipelineValue),
      sub: "HIGH + MEDIUM",
      color: "text-uc-teal",
      border: "border-uc-teal/30",
    },
    {
      label: "Avg Score",
      value: String(stats.avgScore),
      sub: "out of 100",
      color: "text-white",
      border: "border-slate-600",
    },
    {
      label: "Recommended",
      value: String(stats.highPriority),
      sub: `${stats.mediumPriority} worth pursuing`,
      color: "text-uc-teal",
      border: "border-uc-teal/30",
    },
    {
      label: "To Review",
      value: String(stats.lowPriority),
      sub: "lower priority",
      color: "text-uc-yellow",
      border: "border-uc-yellow/30",
    },
    {
      label: "Excluded",
      value: String(stats.totalFound - stats.afterExclusions),
      sub: "filtered out",
      color: "text-slate-400",
      border: "border-slate-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className={`stat-card border-t-2 ${card.border} opacity-0 animate-fade-in-up stagger-${i + 1}`}
        >
          <div className={`text-2xl font-heading font-bold ${card.color}`}>
            {card.value}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-medium">
            {card.label}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
