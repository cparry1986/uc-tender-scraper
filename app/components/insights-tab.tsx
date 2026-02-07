"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { ScrapeResult, AnalyticsData, InsightCard } from "@/lib/types";
import { computeAnalytics } from "@/lib/analytics";

const TEAL = "#00DCBC";
const NAVY = "#00378E";
const PURPLE = "#8B5CF6";
const YELLOW = "#FDE100";
const PINK = "#EC4899";

const PIE_COLORS = [TEAL, NAVY, PURPLE, "#F59E0B", PINK, "#6366F1", "#14B8A6", "#F97316"];

const tooltipStyle = {
  contentStyle: {
    background: "#0F172A",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#E2E8F0",
  },
  cursor: { fill: "rgba(255,255,255,0.02)" },
};

function formatVal(v: number): string {
  if (v >= 1_000_000) return `\u00A3${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `\u00A3${(v / 1_000).toFixed(0)}k`;
  return `\u00A3${v}`;
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-card p-5 ${className || ""}`}>
      <h3 className="font-heading font-bold text-sm text-slate-300 mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InsightCards({ insights }: { insights: InsightCard[] }) {
  if (insights.length === 0) return null;

  const iconMap = {
    positive: "\u2705",
    action: "\u26A1",
    neutral: "\uD83D\uDCCA",
  };

  const borderMap = {
    positive: "border-uc-teal/30",
    action: "border-uc-yellow/30",
    neutral: "border-slate-600",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      {insights.map((insight, i) => (
        <div
          key={i}
          className={`glass-card p-4 border-l-2 ${borderMap[insight.type]}`}
        >
          <span className="mr-2">{iconMap[insight.type]}</span>
          <span className="text-xs text-slate-300 leading-relaxed">
            {insight.text}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function InsightsTab({ result }: { result: ScrapeResult }) {
  const analytics: AnalyticsData = useMemo(
    () => computeAnalytics(result.tenders),
    [result.tenders]
  );

  return (
    <div>
      {/* Key Insight Cards */}
      <InsightCards insights={analytics.insights} />

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Geographic Heatmap */}
        <ChartCard title="Opportunities by Region">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={analytics.regions}
              layout="vertical"
              margin={{ left: 10, right: 10 }}
            >
              <XAxis type="number" stroke="#475569" fontSize={11} />
              <YAxis
                type="category"
                dataKey="region"
                stroke="#475569"
                fontSize={11}
                width={120}
                tick={{ fill: "#94A3B8" }}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: number, name: string) =>
                  name === "totalValue"
                    ? [formatVal(value), "Total Value"]
                    : [value, "Count"]
                }
              />
              <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Procurement Route Donut */}
        <ChartCard title="Procurement Route Breakdown">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={analytics.procurementRoutes}
                dataKey="count"
                nameKey="route"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                stroke="none"
              >
                {analytics.procurementRoutes.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend
                wrapperStyle={{ fontSize: "11px", color: "#94A3B8" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Value Distribution */}
        <ChartCard title="Contract Value Distribution">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={analytics.valueBands}
              margin={{ bottom: 10 }}
            >
              <XAxis
                dataKey="band"
                stroke="#475569"
                fontSize={11}
                tick={{ fill: "#94A3B8" }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis stroke="#475569" fontSize={11} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {analytics.valueBands.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.isSweet ? TEAL : NAVY}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-slate-600 mt-1 text-center">
            Teal bars = UrbanChain sweet spot
          </p>
        </ChartCard>

        {/* Timeline */}
        <ChartCard title="Deadline Timeline (Next 12 Weeks)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.timeline}>
              <XAxis
                dataKey="week"
                stroke="#475569"
                fontSize={10}
                tick={{ fill: "#94A3B8" }}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis stroke="#475569" fontSize={11} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar
                dataKey="count"
                fill={YELLOW}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Buyer Type */}
        <ChartCard title="Buyer Type Analysis" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={analytics.buyerTypes}
              layout="vertical"
              margin={{ left: 10, right: 10 }}
            >
              <XAxis type="number" stroke="#475569" fontSize={11} />
              <YAxis
                type="category"
                dataKey="type"
                stroke="#475569"
                fontSize={11}
                width={140}
                tick={{ fill: "#94A3B8" }}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: number, name: string) =>
                  name === "totalValue"
                    ? [formatVal(value), "Total Value"]
                    : [value, "Count"]
                }
              />
              <Bar dataKey="count" fill={PURPLE} radius={[0, 4, 4, 0]} name="Count" />
              <Bar dataKey="totalValue" fill={TEAL} radius={[0, 4, 4, 0]} name="Total Value" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
