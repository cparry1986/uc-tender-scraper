"use client";

import { useState, useEffect } from "react";
import {
  FrameworkIntelligence,
  TrackedFramework,
  ContractExpiry,
  FrameworkStatus,
} from "@/lib/types";

const STATUS_STYLES: Record<
  FrameworkStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  active: {
    label: "Active",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  "expiring-soon": {
    label: "Expiring Soon",
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
  },
  "re-procuring": {
    label: "Re-procuring",
    bg: "bg-red-500/10",
    text: "text-red-400",
    dot: "bg-red-400 animate-pulse",
  },
  expired: {
    label: "Expired",
    bg: "bg-slate-600/10",
    text: "text-slate-400",
    dot: "bg-slate-500",
  },
  unknown: {
    label: "Unknown",
    bg: "bg-slate-600/10",
    text: "text-slate-500",
    dot: "bg-slate-600",
  },
};

const TIER_STYLES: Record<string, { label: string; color: string }> = {
  critical: { label: "CRITICAL", color: "text-red-400 bg-red-500/10" },
  high: { label: "HIGH", color: "text-yellow-400 bg-yellow-500/10" },
  medium: { label: "MEDIUM", color: "text-slate-400 bg-slate-600/10" },
};

function formatVal(v: number | null): string {
  if (!v) return "Undisclosed";
  if (v >= 1_000_000) return `\u00A3${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `\u00A3${(v / 1_000).toFixed(0)}k`;
  return `\u00A3${v}`;
}

function FrameworkCard({
  fw,
  expanded,
  onToggle,
}: {
  fw: TrackedFramework;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = STATUS_STYLES[fw.currentStatus];
  const tier = TIER_STYLES[fw.tier];

  return (
    <div className="glass-card-hover mb-3 overflow-hidden">
      <div onClick={onToggle} className="p-4 cursor-pointer select-none">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tier.color}`}>
            {tier.label}
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1.5 ${status.bg} ${status.text}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          <span className="text-[10px] text-slate-600">{fw.reference}</span>
          <span className="text-[10px] text-slate-600">{fw.estimatedValue}</span>
          {fw.ftsSignals.length > 0 && (
            <span className="text-[10px] text-uc-teal bg-uc-teal/10 px-1.5 py-0.5 rounded">
              {fw.ftsSignals.length} signal{fw.ftsSignals.length > 1 ? "s" : ""}
            </span>
          )}
          <span className="ml-auto text-slate-600 text-xs">
            {expanded ? "\u25B2" : "\u25BC"}
          </span>
        </div>

        <h3 className="text-sm font-heading font-semibold text-slate-200 leading-snug mb-1">
          {fw.name}
        </h3>
        <p className="text-[11px] text-slate-500">{fw.operator}</p>

        <p className="text-xs text-uc-teal/80 leading-relaxed mt-2 border-l-2 border-uc-teal/30 pl-3">
          {fw.actionRequired}
        </p>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.04]">
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              {fw.description}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div>
                <span className="text-slate-600">Relevance:</span>{" "}
                {fw.relevance}
              </div>
              <div>
                <span className="text-slate-600">Expiry:</span>{" "}
                {fw.expiryDate
                  ? new Date(fw.expiryDate).toLocaleDateString("en-GB")
                  : "Not specified"}
              </div>
              <div>
                <span className="text-slate-600">Next Procurement:</span>{" "}
                {fw.nextProcurementWindow || "Unknown"}
              </div>
              <div>
                <span className="text-slate-600">Estimated Value:</span>{" "}
                {fw.estimatedValue}
              </div>
            </div>

            {fw.ftsSignals.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold text-slate-400 mb-2">
                  FTS Signals
                </h4>
                <div className="space-y-1.5">
                  {fw.ftsSignals.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold mt-0.5 ${
                          s.type === "re-procurement"
                            ? "bg-red-500/10 text-red-400"
                            : s.type === "market-engagement"
                              ? "bg-yellow-500/10 text-yellow-400"
                              : s.type === "award"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-slate-600/10 text-slate-400"
                        }`}
                      >
                        {s.type.replace("-", " ").toUpperCase()}
                      </span>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-uc-teal hover:underline leading-snug flex-1"
                      >
                        {s.title || "View notice"}
                      </a>
                      <span className="text-[10px] text-slate-600 whitespace-nowrap">
                        {s.date
                          ? new Date(s.date).toLocaleDateString("en-GB")
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExpiryRow({ expiry }: { expiry: ContractExpiry }) {
  const days = expiry.daysUntilExpiry;
  const isEstimated = !expiry.expiryDate && !!expiry.estimatedExpiryDate;
  const expiryStr = expiry.expiryDate || expiry.estimatedExpiryDate || "";

  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.03] last:border-0">
      <div
        className={`text-xs font-bold w-14 text-right ${
          days !== null && days < 0
            ? "text-slate-500"
            : days !== null && days <= 180
              ? "text-red-400"
              : days !== null && days <= 365
                ? "text-yellow-400"
                : "text-slate-400"
        }`}
      >
        {days !== null
          ? days < 0
            ? "Expired"
            : `${days}d`
          : "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-300 truncate">{expiry.title}</div>
        <div className="text-[10px] text-slate-500 flex gap-3 mt-0.5">
          <span>{expiry.buyer || "Unknown"}</span>
          <span className="font-medium">{formatVal(expiry.value)}</span>
          {expiry.region && <span>{expiry.region}</span>}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] text-slate-500">
          {expiryStr
            ? new Date(expiryStr).toLocaleDateString("en-GB")
            : "Unknown"}
        </div>
        {isEstimated && (
          <div className="text-[9px] text-yellow-500">est.</div>
        )}
      </div>
    </div>
  );
}

export default function FrameworkTab() {
  const [data, setData] = useState<FrameworkIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showExpiries, setShowExpiries] = useState(true);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/frameworks");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-16">
        <span className="inline-block w-6 h-6 border-2 border-uc-teal border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 mt-3">
          Scanning framework signals across FTS...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-red-400 text-sm mb-3">{error}</p>
        <button
          onClick={loadData}
          className="text-uc-teal text-xs hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const critical = data.frameworks.filter((f) => f.tier === "critical");
  const high = data.frameworks.filter((f) => f.tier === "high");
  const medium = data.frameworks.filter((f) => f.tier === "medium");

  const upcomingExpiries = data.contractExpiries.filter(
    (e) => e.daysUntilExpiry !== null && e.daysUntilExpiry > 0
  );
  const expiredContracts = data.contractExpiries.filter(
    (e) => e.daysUntilExpiry !== null && e.daysUntilExpiry <= 0
  );

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-card border-t-2 border-red-500/30">
          <div className="text-2xl font-heading font-bold text-red-400">
            {data.upcomingReprocurements}
          </div>
          <div className="text-xs text-slate-400 mt-1">Re-procuring</div>
          <div className="text-[10px] text-slate-500">need action now</div>
        </div>
        <div className="stat-card border-t-2 border-yellow-500/30">
          <div className="text-2xl font-heading font-bold text-yellow-400">
            {data.expiringNext6Months}
          </div>
          <div className="text-xs text-slate-400 mt-1">Expiring 6mo</div>
          <div className="text-[10px] text-slate-500">contracts ending</div>
        </div>
        <div className="stat-card border-t-2 border-uc-teal/30">
          <div className="text-2xl font-heading font-bold text-uc-teal">
            {data.frameworks.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Tracked</div>
          <div className="text-[10px] text-slate-500">frameworks</div>
        </div>
        <div className="stat-card border-t-2 border-slate-600">
          <div className="text-2xl font-heading font-bold text-white">
            {data.totalFrameworkValue}
          </div>
          <div className="text-xs text-slate-400 mt-1">Total Value</div>
          <div className="text-[10px] text-slate-500">across frameworks</div>
        </div>
      </div>

      {/* Critical Frameworks */}
      {critical.length > 0 && (
        <FrameworkSection
          title="Critical Frameworks"
          subtitle="Get on these or miss the biggest volume"
          icon="&#128680;"
          color="text-red-400"
          borderColor="border-red-500/30"
          frameworks={critical}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
        />
      )}

      {/* High Priority */}
      {high.length > 0 && (
        <FrameworkSection
          title="High Priority Frameworks"
          subtitle="Strategic PBO relationships to build"
          icon="&#127919;"
          color="text-yellow-400"
          borderColor="border-yellow-500/30"
          frameworks={high}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
        />
      )}

      {/* Medium Priority */}
      {medium.length > 0 && (
        <FrameworkSection
          title="Monitor"
          subtitle="Track for future opportunities"
          icon="&#128064;"
          color="text-slate-400"
          borderColor="border-slate-600/30"
          frameworks={medium}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
        />
      )}

      {/* Contract Expiry Timeline */}
      {upcomingExpiries.length > 0 && (
        <div className="mb-8">
          <div
            className="flex items-center gap-2 mb-4 pb-2 border-b border-uc-teal/30 cursor-pointer select-none"
            onClick={() => setShowExpiries(!showExpiries)}
          >
            <span>&#9200;</span>
            <h2 className="font-heading font-bold text-base text-uc-teal">
              Contract Expiry Timeline
            </h2>
            <span className="text-xs text-slate-500 ml-1">
              ({upcomingExpiries.length} upcoming)
            </span>
            <span className="ml-auto text-xs text-slate-500">
              {showExpiries ? "\u25B2" : "\u25BC"}
            </span>
          </div>
          {showExpiries && (
            <div className="glass-card p-4">
              <p className="text-[11px] text-slate-500 mb-3">
                Electricity contracts approaching expiry — these buyers will
                need to re-procure. Estimated dates based on 4-year contract
                assumption where actual end date is not published.
              </p>
              {upcomingExpiries.slice(0, 20).map((e) => (
                <ExpiryRow key={e.id} expiry={e} />
              ))}
              {upcomingExpiries.length > 20 && (
                <p className="text-[10px] text-slate-600 text-center mt-2">
                  + {upcomingExpiries.length - 20} more
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recently Expired — Re-procurement opportunities */}
      {expiredContracts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-red-500/30">
            <span>&#128276;</span>
            <h2 className="font-heading font-bold text-base text-red-400">
              Recently Expired — Watch for Re-procurement
            </h2>
            <span className="text-xs text-slate-500 ml-1">
              ({expiredContracts.length})
            </span>
          </div>
          <div className="glass-card p-4">
            {expiredContracts.slice(0, 10).map((e) => (
              <ExpiryRow key={e.id} expiry={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FrameworkSection({
  title,
  subtitle,
  icon,
  color,
  borderColor,
  frameworks,
  expandedId,
  onToggle,
}: {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  borderColor: string;
  frameworks: TrackedFramework[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="mb-8">
      <div className={`flex items-center gap-2 mb-1 pb-2 border-b ${borderColor}`}>
        <span dangerouslySetInnerHTML={{ __html: icon }} />
        <h2 className={`font-heading font-bold text-base ${color}`}>
          {title}
        </h2>
        <span className="text-xs text-slate-500 ml-1">
          ({frameworks.length})
        </span>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">{subtitle}</p>
      {frameworks.map((fw) => (
        <FrameworkCard
          key={fw.id}
          fw={fw}
          expanded={expandedId === fw.id}
          onToggle={() => onToggle(fw.id)}
        />
      ))}
    </div>
  );
}
