"use client";

import { useState } from "react";
import { ScoredTender, ScrapeResult } from "@/lib/types";

type Priority = "all" | "high" | "medium" | "low";

export default function Dashboard() {
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(3);
  const [filter, setFilter] = useState<Priority>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function runScrape() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scrape?days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ScrapeResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const eligible = result?.tenders.filter((t) => !t.excluded) ?? [];
  const filtered =
    filter === "all"
      ? eligible
      : filter === "high"
        ? eligible.filter((t) => t.score.total >= 65)
        : filter === "medium"
          ? eligible.filter(
              (t) => t.score.total >= 40 && t.score.total < 65
            )
          : eligible.filter((t) => t.score.total < 40);

  return (
    <div style={{ minHeight: "100vh", background: "#0B1120" }}>
      {/* Header */}
      <header
        style={{
          background: "#00378E",
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#FFF" }}>
            UrbanChain Tender Scraper
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#00DCBC" }}>
            CPV 09310000 &mdash; Electricity Supply Monitoring
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ fontSize: "13px", color: "#94A3B8" }}>
            Days:&nbsp;
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{
                background: "#1E293B",
                color: "#E2E8F0",
                border: "1px solid #334155",
                borderRadius: "6px",
                padding: "6px 10px",
                fontSize: "13px",
              }}
            >
              {[1, 3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={runScrape}
            disabled={loading}
            style={{
              background: loading ? "#334155" : "#00DCBC",
              color: loading ? "#94A3B8" : "#000",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              fontWeight: 700,
              fontSize: "14px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Scraping..." : "Run Scrape"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: "960px", margin: "0 auto", padding: "24px 16px" }}>
        {error && (
          <div
            style={{
              background: "#7F1D1D",
              border: "1px solid #DC2626",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "16px",
              color: "#FCA5A5",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        {/* Stats */}
        {result && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <StatCard label="Total Found" value={result.stats.totalFound} />
            <StatCard label="Eligible" value={result.stats.afterExclusions} />
            <StatCard
              label="High Priority"
              value={result.stats.highPriority}
              accent="#00DCBC"
            />
            <StatCard
              label="Medium"
              value={result.stats.mediumPriority}
              accent="#F59E0B"
            />
            <StatCard label="Low" value={result.stats.lowPriority} accent="#6B7280" />
            <StatCard
              label="Excluded"
              value={
                result.tenders.filter((t) => t.excluded).length
              }
              accent="#EF4444"
            />
          </div>
        )}

        {/* Filter Tabs */}
        {result && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            {(["all", "high", "medium", "low"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                style={{
                  background: filter === p ? "#00378E" : "#1E293B",
                  color: filter === p ? "#FFF" : "#94A3B8",
                  border: filter === p ? "1px solid #00DCBC" : "1px solid #334155",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {p === "all" ? `All (${eligible.length})` : p}
              </button>
            ))}
          </div>
        )}

        {/* Tender Cards */}
        {filtered.map((t) => (
          <TenderCard
            key={t.id}
            tender={t}
            expanded={expandedId === t.id}
            onToggle={() =>
              setExpandedId(expandedId === t.id ? null : t.id)
            }
          />
        ))}

        {/* Empty State */}
        {!result && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              color: "#64748B",
            }}
          >
            <p style={{ fontSize: "18px", marginBottom: "8px" }}>
              UrbanChain Tender Scraper
            </p>
            <p style={{ fontSize: "14px" }}>
              Click &ldquo;Run Scrape&rdquo; to search for electricity supply tenders
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "#1E293B",
        borderRadius: "10px",
        padding: "16px",
        textAlign: "center",
        borderTop: accent ? `3px solid ${accent}` : "3px solid #334155",
      }}
    >
      <div
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: accent || "#E2E8F0",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>
        {label}
      </div>
    </div>
  );
}

function TenderCard({
  tender,
  expanded,
  onToggle,
}: {
  tender: ScoredTender;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = tender;
  const priorityColor =
    t.score.total >= 65
      ? "#00DCBC"
      : t.score.total >= 40
        ? "#F59E0B"
        : "#6B7280";
  const priorityLabel =
    t.score.total >= 65 ? "HIGH" : t.score.total >= 40 ? "MEDIUM" : "LOW";

  const formatVal = (v: number | null) => {
    if (!v) return "Not disclosed";
    if (v >= 1_000_000) return `\u00A3${(v / 1_000_000).toFixed(1)}m`;
    if (v >= 1_000) return `\u00A3${(v / 1_000).toFixed(0)}k`;
    return `\u00A3${v}`;
  };

  return (
    <div
      style={{
        background: "#1E293B",
        borderRadius: "10px",
        marginBottom: "12px",
        borderLeft: `4px solid ${priorityColor}`,
        overflow: "hidden",
      }}
    >
      {/* Header row — always visible */}
      <div
        onClick={onToggle}
        style={{
          padding: "16px 20px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "6px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                background: priorityColor,
                color: "#000",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              {priorityLabel} ({t.score.total})
            </span>
            <span style={{ color: "#64748B", fontSize: "12px" }}>
              {t.source === "find-a-tender"
                ? "Find a Tender"
                : "Contracts Finder"}
            </span>
          </div>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#E2E8F0" }}>
            {t.title}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#94A3B8",
              marginTop: "6px",
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <span>{t.buyer || "Unknown buyer"}</span>
            <span>{formatVal(t.value)}</span>
            <span>{t.deadlineDate ? new Date(t.deadlineDate).toLocaleDateString("en-GB") : "No deadline"}</span>
          </div>
        </div>
        <span
          style={{
            color: "#64748B",
            fontSize: "20px",
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {expanded ? "\u25B2" : "\u25BC"}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            padding: "0 20px 20px",
            borderTop: "1px solid #334155",
          }}
        >
          {/* Score breakdown */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "8px",
              margin: "16px 0",
            }}
          >
            <ScoreBar label="Value" score={t.score.value} max={30} />
            <ScoreBar label="Timeline" score={t.score.timeline} max={20} />
            <ScoreBar label="Keywords" score={t.score.keywords} max={30} />
            <ScoreBar label="Geography" score={t.score.geography} max={20} />
          </div>

          {/* Description */}
          {t.description && (
            <p
              style={{
                fontSize: "13px",
                color: "#94A3B8",
                lineHeight: 1.6,
                margin: "12px 0",
              }}
            >
              {t.description.length > 500
                ? t.description.slice(0, 500) + "..."
                : t.description}
            </p>
          )}

          {/* Metadata */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              fontSize: "13px",
              color: "#94A3B8",
              margin: "12px 0",
            }}
          >
            <div>
              <strong style={{ color: "#64748B" }}>Location:</strong>{" "}
              {t.location || "Not specified"}
            </div>
            <div>
              <strong style={{ color: "#64748B" }}>Published:</strong>{" "}
              {t.publishedDate
                ? new Date(t.publishedDate).toLocaleDateString("en-GB")
                : "Unknown"}
            </div>
            <div>
              <strong style={{ color: "#64748B" }}>CPV Codes:</strong>{" "}
              {t.cpvCodes.length > 0 ? t.cpvCodes.join(", ") : "None"}
            </div>
            <div>
              <strong style={{ color: "#64748B" }}>Source ID:</strong> {t.id}
            </div>
          </div>

          <a
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: "8px",
              background: "#00378E",
              color: "#FFF",
              padding: "8px 20px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View on {t.source === "find-a-tender" ? "Find a Tender" : "Contracts Finder"} &#8599;
          </a>
        </div>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  score,
  max,
}: {
  label: string;
  score: number;
  max: number;
}) {
  const pct = Math.round((score / max) * 100);
  const color =
    pct >= 75 ? "#00DCBC" : pct >= 50 ? "#F59E0B" : "#6B7280";

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "11px",
          color: "#94A3B8",
          marginBottom: "4px",
        }}
      >
        <span>{label}</span>
        <span>
          {score}/{max}
        </span>
      </div>
      <div
        style={{
          background: "#0F172A",
          borderRadius: "4px",
          height: "6px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: "4px",
          }}
        />
      </div>
    </div>
  );
}
