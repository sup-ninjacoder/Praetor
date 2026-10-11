"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Code2,
  Layout,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  GitCommit,
  FileVideo,
  ArrowLeft,
  Trophy,
  Loader2,
  Share2,
  TrendingDown,
  Workflow,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface EvaluationItem {
  id: string;
  repoUrl: string;
  repoId: string;
  commitSha: string;
  ref: string;
  codeScore: number;
  uiScore: number;
  totalScore: number;
  isFrontendConnected: boolean;
  feedback: string;
  goodPractices?: string;
  badPractices?: string;
  deductionReasons?: string;
  architecturalSummary?: string;
  feedbackHash: string;
  txHash?: string;
  contractAddress?: string;
  snowtraceUrl?: string;
  onChainEvaluationId?: string;
  onChainError?: string;
  filesAnalyzed: number;
  videoName?: string;
  createdAt: string;
}

function EvaluateContent() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [evaluation, setEvaluation] = useState<EvaluationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copiedTx, setCopiedTx] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("No evaluation ID specified.");
      return;
    }

    async function fetchEval() {
      try {
        setLoading(true);
        const res = await fetch(`/api/evaluations/${id}`);
        const data = await res.json().catch(() => null);

        if (res.ok && data?.success && data?.evaluation) {
          setEvaluation(data.evaluation);
          setError(null);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn(`[Praetor] Remote fetch for ${id} failed, checking localStorage fallback:`, err);
      }

      // Robust Client-Side Fallback on Result Page:
      // When fetching /api/evaluations/${id}, if the response status is 404 or fails, immediately check localStorage
      if (typeof window !== "undefined") {
        try {
          const directKey = `praetor_eval_${id}`;
          const cachedRaw = localStorage.getItem(directKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            const item: EvaluationItem = cached?.evaluation || cached;
            if (item && (item.codeScore !== undefined || item.repoUrl)) {
              setEvaluation(item);
              setError(null);
              setLoading(false);
              return;
            }
          }

          // Also check praetor_recent_evaluations list
          const recentRaw = localStorage.getItem("praetor_recent_evaluations");
          if (recentRaw) {
            const recentList = JSON.parse(recentRaw);
            if (Array.isArray(recentList)) {
              const found = recentList.find(
                (entry: any) =>
                  entry?.id === id ||
                  entry?.onChainEvaluationId === id ||
                  entry?.txHash === id ||
                  (entry?.evaluation && (entry.evaluation.id === id || entry.evaluation.onChainEvaluationId === id || entry.evaluation.txHash === id))
              );
              if (found) {
                const item: EvaluationItem = found?.evaluation || found;
                if (item && (item.codeScore !== undefined || item.repoUrl)) {
                  setEvaluation(item);
                  setError(null);
                  setLoading(false);
                  return;
                }
              }
            }
          }
        } catch (storageErr) {
          console.warn("[Praetor] Failed to read cached evaluation from localStorage:", storageErr);
        }
      }

      setError("Evaluation record not found.");
      setLoading(false);
    }
    fetchEval();
  }, [id]);

  const handleCopy = (text: string, type: "tx" | "hash" | "link") => {
    navigator.clipboard.writeText(text);
    if (type === "tx") {
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 2000);
    } else if (type === "hash") {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
    toast.success("Copied to clipboard");
  };

  const shareLink = () => {
    if (typeof window !== "undefined") {
      handleCopy(window.location.href, "link");
    }
  };

  return (
    <main className="relative min-h-[calc(100dvh-4rem)] w-full overflow-hidden bg-black text-white antialiased flex flex-col justify-between selection:bg-white/20 selection:text-white">
      {/* Background Visuals */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="cosmic-rays animate-slow-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[1400px] w-[1400px] opacity-60" />
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full bg-radial from-white/[0.06] via-zinc-900/[0.02] to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-30" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-8 md:py-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Submit</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={shareLink}
              className="h-8 gap-1.5 border-white/10 bg-white/5 text-xs text-zinc-300 hover:text-white hover:bg-white/10"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{copiedLink ? "Link Copied!" : "Share"}</span>
            </Button>
            <Link href="/leaderboard">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-white/10 bg-white/5 text-xs text-zinc-300 hover:text-white hover:bg-white/10"
              >
                <Trophy className="h-3.5 w-3.5 text-zinc-300" />
                <span>Leaderboard</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Loading state skeleton */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <p className="text-sm font-mono text-zinc-400">Loading evaluation record...</p>
          </div>
        )}

        {/* Graceful Fallback / Record Not Found state */}
        {!loading && (!evaluation || error) && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
            <h2 className="text-lg font-semibold text-white">Record Not Found</h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              {error || "The requested evaluation could not be located in local cache or on-chain."}
            </p>
            <Button onClick={() => router.push("/")} className="bg-white text-black hover:bg-zinc-200">
              Back to Submit
            </Button>
          </div>
        )}

        {/* Evaluation Details */}
        {!loading && evaluation && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Header Glassmorphic Card */}
            <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-6 md:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-zinc-500 font-mono">
                      Verdict Record #{((evaluation?.id || "")).slice(0, 8)}
                    </span>
                    {(evaluation?.txHash || "") ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] text-emerald-400">
                        <ShieldCheck className="h-3 w-3" />
                        On-Chain Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[11px] text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        Off-Chain Verified
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-white">
                    {evaluation?.repoId || (evaluation?.repoUrl ? evaluation.repoUrl.replace("https://github.com/", "") : "Repository")}
                  </h1>
                  {evaluation?.repoUrl && (
                    <a
                      href={evaluation.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white underline underline-offset-4"
                    >
                      <span>{evaluation.repoUrl}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                <div className="flex flex-col sm:items-end gap-1.5">
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <GitCommit className="h-3.5 w-3.5" />
                    <span>{(evaluation?.commitSha || "").slice(0, 7) || "HEAD"}</span>
                    <span className="text-zinc-600">|</span>
                    <span>{evaluation?.filesAnalyzed ?? 0} files</span>
                  </div>
                  {evaluation?.videoName && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-zinc-300">
                      <FileVideo className="h-3 w-3 text-zinc-400" />
                      <span className="truncate max-w-[160px]">{evaluation.videoName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Score Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Code Score */}
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span className="flex items-center gap-1.5">
                      <Code2 className="h-3.5 w-3.5" />
                      Code Quality
                    </span>
                    <span className="font-mono text-zinc-500">Weight 60%</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-semibold tracking-tight text-white">
                      {evaluation.codeScore}
                    </span>
                    <span className="text-xs text-zinc-500">/ 100</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-1000"
                      style={{ width: `${evaluation.codeScore}%` }}
                    />
                  </div>
                </div>

                {/* UI Score */}
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span className="flex items-center gap-1.5">
                      <Layout className="h-3.5 w-3.5" />
                      UI / Demo Polish
                    </span>
                    <span className="font-mono text-zinc-500">Weight 40%</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-semibold tracking-tight text-white">
                      {evaluation.uiScore}
                    </span>
                    <span className="text-xs text-zinc-500">/ 100</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-300 transition-all duration-1000"
                      style={{ width: `${evaluation.uiScore}%` }}
                    />
                  </div>
                </div>

                {/* Integration Check */}
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span>Integration Check</span>
                    <span className="font-mono text-zinc-500">Gemma 4</span>
                  </div>
                  <div className="py-1">
                    {evaluation.isFrontendConnected ? (
                      <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Frontend Connected</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-400">
                        <AlertCircle className="h-4 w-4" />
                        <span>Mockup / Unconnected</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-snug">
                    {evaluation.isFrontendConnected
                      ? "UI demonstrations match underlying codebase endpoints and contract ABIs."
                      : "Visual demo lacks corresponding backend implementation in repository."}
                  </p>
                </div>
              </div>

              {/* Deep Code Review & Video Analysis Bento Box Grid */}
              {(evaluation.goodPractices || evaluation.badPractices || evaluation.deductionReasons || evaluation.architecturalSummary) ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs uppercase tracking-wider text-zinc-400 font-mono font-medium flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
                      Multimodal Diagnostic Review
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      Senior Principal Verdict
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Good Practices Card (Emerald) */}
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-2.5 backdrop-blur-sm transition-all hover:border-emerald-500/30">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium tracking-wide">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        <span className="font-semibold uppercase tracking-wider text-[11px]">Good Practices & Architecture</span>
                      </div>
                      <p className="text-sm text-emerald-300 leading-relaxed font-sans">
                        {evaluation.goodPractices || "Well-structured codebase adhering to modular separation and clean contracts."}
                      </p>
                    </div>

                    {/* Anti-Patterns & Bad Practices Card (Red/Orange) */}
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-2.5 backdrop-blur-sm transition-all hover:border-red-500/30">
                      <div className="flex items-center gap-2 text-red-400 text-xs font-medium tracking-wide">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
                        <span className="font-semibold uppercase tracking-wider text-[11px]">Anti-Patterns & Bad Practices</span>
                      </div>
                      <p className="text-sm text-red-300 leading-relaxed font-sans">
                        {evaluation.badPractices || "No critical anti-patterns or bloat detected in repository traversal."}
                      </p>
                    </div>

                    {/* Score Deductions Card (Yellow/Amber) */}
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-2.5 backdrop-blur-sm transition-all hover:border-amber-500/30">
                      <div className="flex items-center gap-2 text-amber-400 text-xs font-medium tracking-wide">
                        <TrendingDown className="h-4 w-4 shrink-0 text-amber-400" />
                        <span className="font-semibold uppercase tracking-wider text-[11px]">Score Deductions</span>
                      </div>
                      <p className="text-sm text-amber-300 leading-relaxed font-sans">
                        {evaluation.deductionReasons || "Minimal deductions applied across UI polish and test coverage."}
                      </p>
                    </div>

                    {/* Architecture Flow Card (Deep Zinc/White) */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2.5 backdrop-blur-sm transition-all hover:border-white/20">
                      <div className="flex items-center gap-2 text-zinc-300 text-xs font-medium tracking-wide">
                        <Workflow className="h-4 w-4 shrink-0 text-zinc-300" />
                        <span className="font-semibold uppercase tracking-wider text-[11px]">Architecture Flow</span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed font-sans">
                        {evaluation.architecturalSummary || "Full-stack integration linking client interface with smart contract backend."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Fallback for legacy single feedback paragraph */
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
                  <span className="text-xs uppercase tracking-wider text-zinc-500 font-mono">
                    Gemma 4 Evaluation Verdict & Feedback
                  </span>
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line font-sans">
                    {evaluation.feedback}
                  </p>
                </div>
              )}

              {/* On-Chain Anchoring Meta & Snowtrace Link */}
              <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 space-y-3.5 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="font-medium text-zinc-300">
                    Avalanche Fuji Testnet Anchor
                  </span>
                  <span className="font-mono text-zinc-500">Chain ID 43113</span>
                </div>

                {evaluation?.txHash ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-white/5 pt-3">
                    <span className="text-zinc-500 font-mono">Transaction Hash</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-300 truncate max-w-[200px] sm:max-w-[320px]">
                        {(evaluation?.txHash || "")}
                      </span>
                      <button
                        onClick={() => handleCopy(evaluation?.txHash || "", "tx")}
                        className="text-zinc-400 hover:text-white"
                        title="Copy Tx Hash"
                      >
                        {copiedTx ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <a
                        href={evaluation.snowtraceUrl || `https://testnet.snowtrace.io/tx/${evaluation.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-white hover:underline ml-1 font-medium"
                      >
                        <span>View on Snowtrace</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ) : evaluation?.onChainError ? (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-300">
                    {evaluation.onChainError}
                  </div>
                ) : null}

                {/* Contract Address */}
                {(evaluation?.contractAddress || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS) && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-white/5 pt-3">
                    <span className="text-zinc-500 font-mono">Contract Address</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-300">
                        {((evaluation?.contractAddress || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "")).slice(0, 10)}...{((evaluation?.contractAddress || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "")).slice(-4)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Feedback SHA-256 Hash */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-white/5 pt-3">
                  <span className="text-zinc-500 font-mono">Feedback Hash (SHA-256)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-zinc-300 truncate max-w-[200px] sm:max-w-[320px]">
                      {evaluation?.feedbackHash || "N/A"}
                    </span>
                    {evaluation?.feedbackHash && (
                      <button
                        onClick={() => handleCopy(evaluation.feedbackHash, "hash")}
                        className="text-zinc-400 hover:text-white"
                        title="Copy Feedback Hash"
                      >
                        {copiedHash ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {evaluation?.onChainEvaluationId && (
                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-zinc-500 font-mono">On-Chain Evaluation ID</span>
                    <span className="font-mono text-zinc-300">
                      #{evaluation.onChainEvaluationId}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

export default function EvaluateResultPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          <p className="text-sm font-mono text-zinc-400">Loading evaluation record...</p>
        </div>
      }
    >
      <EvaluateContent />
    </React.Suspense>
  );
}

