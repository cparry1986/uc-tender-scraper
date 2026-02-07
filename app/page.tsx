"use client";

import { useState } from "react";
import { ScrapeResult } from "@/lib/types";
import PipelineTab from "./components/pipeline-tab";
import InsightsTab from "./components/insights-tab";
import FrameworkTab from "./components/framework-tab";

type Tab = "pipeline" | "insights" | "frameworks";

export default function Dashboard() {
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(3);
  const [activeTab, setActiveTab] = useState<Tab>("pipeline");

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

  return (
    <div className="min-h-screen bg-uc-bg">
      {/* Header */}
      <header className="bg-gradient-to-r from-uc-navy to-uc-purple relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,220,188,0.08),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-4 py-5 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-white tracking-tight">
              UrbanChain Tender Intelligence
            </h1>
            <p className="text-uc-teal text-xs mt-1 font-medium">
              CPV 09310000 &mdash; Electricity Supply Monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 flex items-center gap-2">
              Days:
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="bg-white/[0.06] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-uc-teal/50"
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
              className={`relative px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                loading
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-uc-teal text-uc-bg hover:shadow-lg hover:shadow-uc-teal/20 hover:-translate-y-0.5 active:translate-y-0"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  Scraping...
                </span>
              ) : (
                "Run Scrape"
              )}
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="relative max-w-6xl mx-auto px-4 flex gap-1 -mb-px">
          {result && (
            <>
              <TabButton
                active={activeTab === "pipeline"}
                onClick={() => setActiveTab("pipeline")}
                label="Pipeline"
              />
              <TabButton
                active={activeTab === "insights"}
                onClick={() => setActiveTab("insights")}
                label="Insights"
              />
            </>
          )}
          <TabButton
            active={activeTab === "frameworks"}
            onClick={() => setActiveTab("frameworks")}
            label="Frameworks"
          />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm">
            {error}
          </div>
        )}

        {activeTab === "frameworks" && <FrameworkTab />}

        {result &&
          activeTab !== "frameworks" &&
          (activeTab === "pipeline" ? (
            <PipelineTab result={result} />
          ) : (
            <InsightsTab result={result} />
          ))}

        {/* Empty state */}
        {!result && !loading && activeTab !== "frameworks" && (
          <div className="text-center py-24">
            <div className="inline-block mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-uc-navy to-uc-purple flex items-center justify-center">
                <span className="text-2xl">&#9889;</span>
              </div>
            </div>
            <h2 className="font-heading text-xl font-bold text-slate-300 mb-2">
              UrbanChain Tender Intelligence
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Search UK public sector tender APIs for electricity supply
              opportunities matched to UrbanChain&apos;s business model.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
        active
          ? "bg-uc-bg text-uc-teal border-t border-x border-uc-teal/20"
          : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
