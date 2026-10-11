"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  ExternalLink,
  ShieldCheck,
  Search,
  ArrowRight,
  Code2,
  Layout,
  RotateCw,
  Crown,
  Medal,
  Terminal,
  Copy,
  Check,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface LeaderboardItem {
  id: string;
  onChainEvaluationId: string;
  repoUrl: string;
  repoName: string;
  commitSha: string;
  codeScore: number;
  uiScore: number;
  totalScore: number;
  feedbackHash: string;
  txHash?: string;
  snowtraceUrl?: string;
  timestamp: number;
  createdAt: string;
  recordedBy: string;
  isFrontendConnected: boolean;
  feedback?: string;
  goodPractices?: string;
  badPractices?: string;
  deductionReasons?: string;
  architecturalSummary?: string;
  videoName?: string;
}

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x8dF146E5B190DB9B3a397E9456B2002A4EE38439";

export default function LeaderboardPage() {
  const [evaluations, setEvaluations] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedContract, setCopiedContract] = useState(false);

  const fetchLeaderboard = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetch("/api/evaluations", { cache: "no-store" });
      const data = await res.json();

      let list: LeaderboardItem[] = data.success && Array.isArray(data.evaluations) ? data.evaluations : [];

      if (typeof window !== "undefined") {
        try {
          const recentRaw = localStorage.getItem("praetor_recent_evaluations");
          if (recentRaw) {
            const recentList = JSON.parse(recentRaw);
            if (Array.isArray(recentList)) {
              const mappedRecent: LeaderboardItem[] = recentList.map((item: any) => ({
                id: item.id || `eval-${Date.now()}`,
                onChainEvaluationId: item.onChainEvaluationId || "pending",
                repoUrl: item.repoUrl || "",
                repoName: item.repoId || (item.repoUrl ? item.repoUrl.replace(/^https?:\/\/github\.com\//, "") : "submission"),
                commitSha: item.commitSha || "main",
                codeScore: item.codeScore ?? item.evaluation?.codeScore ?? 50,
                uiScore: item.uiScore ?? item.evaluation?.uiScore ?? 50,
                totalScore:
                  item.totalScore ??
                  Math.round(
                    (item.codeScore ?? item.evaluation?.codeScore ?? 50) * 0.6 +
                      (item.uiScore ?? item.evaluation?.uiScore ?? 50) * 0.4
                  ),
                feedbackHash: item.feedbackHash || "",
                txHash: item.txHash,
                snowtraceUrl: item.snowtraceUrl,
                timestamp: Math.floor(new Date(item.createdAt || Date.now()).getTime() / 1000),
                createdAt: item.createdAt || new Date().toISOString(),
                recordedBy: item.recordedBy || "Praetor Registry",
                isFrontendConnected: item.isFrontendConnected ?? true,
                videoName: item.videoName || item.meta?.videoName,
              }));
              list = [...mappedRecent, ...list];
            }
          }
        } catch (storageErr) {
          console.warn("[Praetor] Failed to merge recent evaluations in leaderboard:", storageErr);
        }
      }

      setEvaluations(list);
      if (isManualRefresh && data.success) {
        toast.success("Leaderboard updated from Avalanche Fuji");
      }
    } catch (err) {
      console.error("Failed to fetch evaluations:", err);
      toast.error("Error communicating with Fuji RPC.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleCopyContract = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopiedContract(true);
    toast.success("Contract address copied");
    setTimeout(() => setCopiedContract(false), 2000);
  };

  const uniqueEvaluations = Array.from(
    new Map(
      evaluations.map((item) => [
        item.id || item.txHash || `${item.repoUrl}-${item.timestamp}`,
        item,
      ])
    ).values()
  );

  const filtered = uniqueEvaluations.filter(
    (item) =>
      item.repoName.toLowerCase().includes(search.toLowerCase()) ||
      item.repoUrl.toLowerCase().includes(search.toLowerCase()) ||
      item.commitSha.toLowerCase().includes(search.toLowerCase())
  );

  const highestScore = uniqueEvaluations.length
    ? Math.max(...uniqueEvaluations.map((i) => i.totalScore))
    : 0;

  const avgCodeScore = uniqueEvaluations.length
    ? Math.round(
        uniqueEvaluations.reduce((acc, i) => acc + i.codeScore, 0) /
          uniqueEvaluations.length
      )
    : 0;

  const avgUiScore = uniqueEvaluations.length
    ? Math.round(
        uniqueEvaluations.reduce((acc, i) => acc + i.uiScore, 0) /
          uniqueEvaluations.length
      )
    : 0;

  return (
    <main className="relative min-h-[calc(100dvh-4rem)] w-full overflow-hidden bg-black text-white antialiased flex flex-col justify-between selection:bg-white/20 selection:text-white">
      {/* ──────────────── Cosmic Background Visuals ──────────────── */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="cosmic-rays animate-slow-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[1500px] w-[1500px] opacity-60" />
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 -translate-y-1/2 h-[750px] w-[750px] rounded-full bg-radial from-white/[0.07] via-zinc-900/[0.02] to-transparent blur-3xl animate-subtle-pulse" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-35" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 md:py-12 space-y-8">
        {/* ──────────────── Header Section ──────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white">
              Public Web3 Leaderboard
            </h1>

            <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
              Real-time rankings aggregated directly from the{" "}
              <code className="text-xs text-zinc-200 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                AgentJudgeRegistry
              </code>{" "}
              smart contract. Immutable verdicts computed by multimodal Gemma 4.
            </p>
          </div>

          {/* Action CTAs & Contract Pill */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleCopyContract}
              title="Copy Fuji Contract Address"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:border-white/20 transition-colors"
            >
              <Terminal className="h-3.5 w-3.5 text-zinc-400" />
              <span className="font-mono">
                {(CONTRACT_ADDRESS || "").slice(0, 6)}...{(CONTRACT_ADDRESS || "").slice(-4)}
              </span>
              {copiedContract ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3 text-zinc-400" />
              )}
            </button>

            <a
              href={`https://testnet.snowtrace.io/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span>Snowtrace</span>
              <ExternalLink className="h-3 w-3 text-zinc-400" />
            </a>

            <Link href="/">
              <Button className="h-8 gap-1.5 bg-white text-black hover:bg-zinc-200 text-xs px-3.5 rounded-full font-medium">
                <Send className="h-3 w-3" />
                <span>Submit Project</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* ──────────────── Telemetry Metrics Row ──────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4.5 backdrop-blur-xl">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              On-Chain Submissions
            </span>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-mono mt-1">
              {loading ? "..." : uniqueEvaluations.length}
            </div>
            <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
              Direct from Fuji RPC
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4.5 backdrop-blur-xl">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Top Score
            </span>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-amber-400 font-mono mt-1">
              {loading ? "..." : highestScore}
              <span className="text-xs text-zinc-500 font-sans ml-1">/ 200</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
              Rank #1 Total Verdict
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4.5 backdrop-blur-xl">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Avg Code Quality
            </span>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-200 font-mono mt-1">
              {loading ? "..." : `${avgCodeScore}`}
              <span className="text-xs text-zinc-500 font-sans ml-1">/ 100</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
              AST AST Context Engine
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4.5 backdrop-blur-xl">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Avg UI / Demo Polish
            </span>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-emerald-400 font-mono mt-1">
              {loading ? "..." : `${avgUiScore}`}
              <span className="text-xs text-zinc-500 font-sans ml-1">/ 100</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
              Gemma Multimodal Vision
            </span>
          </div>
        </div>

        {/* ──────────────── Filter & Refresh Controls ──────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by project name, repo, or commit SHA..."
              className="w-full rounded-full border border-white/10 bg-zinc-950/80 py-2 pl-10 pr-4 text-xs text-zinc-200 placeholder:text-zinc-500 backdrop-blur-md focus:border-white/25 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || refreshing}
              onClick={() => fetchLeaderboard(true)}
              className="h-8 gap-1.5 border-white/10 bg-zinc-950/80 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-full"
            >
              <RotateCw
                className={`h-3.5 w-3.5 ${
                  refreshing ? "animate-spin text-white" : "text-zinc-400"
                }`}
              />
              <span>{refreshing ? "Querying RPC..." : "Sync Contract"}</span>
            </Button>
          </div>
        </div>

        {/* ──────────────── Loading Skeletons ──────────────── */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/5 bg-zinc-950/40 p-4 md:p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-white/5" />
                  <div className="space-y-2">
                    <div className="h-4 w-48 rounded bg-white/5" />
                    <div className="h-3 w-32 rounded bg-white/5" />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="h-8 w-16 rounded bg-white/5" />
                  <div className="h-8 w-16 rounded bg-white/5" />
                  <div className="h-8 w-24 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ──────────────── Empty State ──────────────── */}
        {!loading && uniqueEvaluations.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl border border-dashed border-white/15 bg-zinc-950/40 p-12 text-center space-y-4 backdrop-blur-xl"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Trophy className="h-7 w-7 text-amber-400/80" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-base font-semibold text-white">
                No Evaluations Recorded On-Chain Yet
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                The smart contract at{" "}
                <span className="font-mono text-zinc-300">
                  {(CONTRACT_ADDRESS || "").slice(0, 10)}...
                </span>{" "}
                is awaiting its first verified hackathon evaluation.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/">
                <Button className="bg-white text-black hover:bg-zinc-200 text-xs px-5 rounded-full font-medium">
                  Be the First to Submit
                </Button>
              </Link>
            </div>
          </motion.div>
        )}

        {/* ──────────────── Ranked Leaderboard List ──────────────── */}
        {!loading && uniqueEvaluations.length > 0 && (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-8 text-center space-y-3">
                <p className="text-xs text-zinc-400">
                  No submissions matched your search query.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearch("")}
                  className="border-white/10 text-xs rounded-full"
                >
                  Clear Search
                </Button>
              </div>
            ) : (
              filtered.map((item, index) => {
                const rank = index + 1;
                const isFirst = rank === 1;
                const isSecond = rank === 2;
                const isThird = rank === 3;

                return (
                  <motion.div
                    key={`${item.id || 'eval'}-${item.txHash || index}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.05 }}
                    className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 backdrop-blur-xl transition-all duration-200 ${
                      isFirst
                        ? "border-amber-400/25 bg-amber-400/[0.03] shadow-[0_0_30px_-12px_rgba(251,191,36,0.12)] hover:border-amber-400/40"
                        : isSecond
                        ? "border-zinc-300/20 bg-zinc-200/[0.02] shadow-[0_0_30px_-12px_rgba(255,255,255,0.08)] hover:border-zinc-300/35"
                        : isThird
                        ? "border-amber-700/25 bg-amber-700/[0.02] shadow-[0_0_30px_-12px_rgba(180,83,9,0.08)] hover:border-amber-700/40"
                        : "border-white/5 bg-zinc-950/70 hover:border-white/15 hover:bg-zinc-900/40"
                    }`}
                  >
                    {/* Rank Position & Clean Project Info */}
                    <div className="flex items-center gap-4">
                      {/* Podium Highlight Rank Badge */}
                      <div
                        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl font-mono text-sm font-semibold transition-transform group-hover:scale-105 ${
                          isFirst
                            ? "border border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                            : isSecond
                            ? "border border-zinc-300/30 bg-white/10 text-zinc-100"
                            : isThird
                            ? "border border-amber-700/40 bg-amber-700/15 text-amber-500"
                            : "border border-white/10 bg-white/5 text-zinc-400"
                        }`}
                      >
                        {isFirst ? (
                          <div className="flex flex-col items-center">
                            <Crown className="h-3.5 w-3.5 text-amber-400 mb-0.5" />
                            <span className="text-[11px] leading-none">1st</span>
                          </div>
                        ) : isSecond ? (
                          <div className="flex flex-col items-center">
                            <Medal className="h-3.5 w-3.5 text-zinc-200 mb-0.5" />
                            <span className="text-[11px] leading-none">2nd</span>
                          </div>
                        ) : isThird ? (
                          <div className="flex flex-col items-center">
                            <Medal className="h-3.5 w-3.5 text-amber-600 mb-0.5" />
                            <span className="text-[11px] leading-none">3rd</span>
                          </div>
                        ) : (
                          <span>#{rank}</span>
                        )}
                      </div>

                      {/* Clean Project Name & Minimalist GitHub Link */}
                      <div className="space-y-0.5">
                        <Link
                          href={`/evaluate/${item.id}`}
                          className="text-sm sm:text-base font-semibold text-white group-hover:text-zinc-100 hover:underline transition-colors block"
                        >
                          {item.repoName}
                        </Link>

                        <div>
                          <a
                            href={item.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
                          >
                            <span>GitHub</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* ──────────────── Scores Breakdown & Transparency Anchor ──────────────── */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t border-white/5 sm:border-0">
                      {/* Code Score Breakdown */}
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase font-mono text-zinc-500 flex items-center gap-1">
                          <Code2 className="h-2.5 w-2.5" /> Code
                        </span>
                        <div className="flex items-baseline gap-0.5 mt-0.5">
                          <span className="text-sm font-semibold text-white font-mono tabular-nums">
                            {item.codeScore}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono tabular-nums">/100</span>
                        </div>
                      </div>

                      {/* UI Score Breakdown */}
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase font-mono text-zinc-500 flex items-center gap-1">
                          <Layout className="h-2.5 w-2.5" /> UI
                        </span>
                        <div className="flex items-baseline gap-0.5 mt-0.5">
                          <span className="text-sm font-semibold text-zinc-200 font-mono tabular-nums">
                            {item.uiScore}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono tabular-nums">/100</span>
                        </div>
                      </div>

                      {/* Total Score */}
                      <div className="flex flex-col items-center px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/5 min-w-[70px]">
                        <span className="text-[10px] uppercase font-mono text-zinc-400">
                          Total
                        </span>
                        <span
                          className={`text-base font-bold font-mono tabular-nums ${
                            isFirst
                              ? "text-amber-400"
                              : isSecond
                              ? "text-zinc-100"
                              : isThird
                              ? "text-amber-500"
                              : "text-white"
                          }`}
                        >
                          {item.totalScore}
                        </span>
                      </div>

                      {/* Transparency Anchor: Verify on Fuji Link */}
                      <div className="flex flex-col items-end gap-1.5 min-w-[120px]">
                        {item.txHash ? (
                          <a
                            href={
                              item.snowtraceUrl ||
                              `https://testnet.snowtrace.io/tx/${item.txHash}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15 transition-all"
                          >
                            <ShieldCheck className="h-3 w-3 shrink-0" />
                            <span>Verify on Fuji</span>
                            <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                          </a>
                        ) : (
                          <a
                            href={`https://testnet.snowtrace.io/address/${CONTRACT_ADDRESS}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                          >
                            <span>Verify Contract</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}

                        <Link
                          href={`/evaluate/${item.id}`}
                          className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
                        >
                          <span>Full Verdict</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}
      </div>
    </main>
  );
}
