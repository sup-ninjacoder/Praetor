import { NextResponse } from "next/server";
import { getReadOnlyRegistryContract } from "@/lib/contractClient";
import { getAllEvaluations, type EvaluationItem } from "@/lib/evaluationsStore";

export interface OnChainLeaderboardItem {
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

function cleanRepoName(url: string): string {
  try {
    const cleaned = url.replace(/\/$/, "");
    const match = cleaned.match(/github\.com\/([^/]+\/[^/]+)/);
    if (match) return match[1].replace(/\.git$/, "");
    return cleaned.replace(/^https?:\/\//, "");
  } catch {
    return url;
  }
}

export async function GET() {
  const storeItems = getAllEvaluations();

  try {
    const contract = getReadOnlyRegistryContract();
    const totalCount = Number(await contract.totalEvaluations());

    // If no evaluations are recorded on the contract yet
    if (totalCount === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        totalOnChain: 0,
        evaluations: [],
        source: "blockchain",
      });
    }

    // Query events to discover transaction hashes for each evaluationId
    const txMap = new Map<string, string>();
    try {
      const events = await contract.queryFilter("EvaluationRecorded");
      for (const e of events) {
        if ("args" in e && e.args && e.args[0] !== undefined) {
          txMap.set(e.args[0].toString(), e.transactionHash);
        }
      }
    } catch (eventErr) {
      console.warn("[Leaderboard API] Warning: Failed to query past events for txHashes:", eventErr);
    }

    // Strictly 0-indexed loop: dynamic array indexes run from 0 to totalCount - 1
    const items: OnChainLeaderboardItem[] = [];
    for (let i = 0; i < totalCount; i++) {
      let raw = await contract.getEvaluation(i);
      let idStr = i.toString();

      // Graceful fallback if contract deployment was legacy 1-indexed (index 0 empty, index 1 populated)
      if (!raw || !raw.repoUrl || raw.repoUrl === "") {
        try {
          const alt = await contract.getEvaluation(i + 1);
          if (alt && alt.repoUrl) {
            raw = alt;
            idStr = (i + 1).toString();
          }
        } catch {}
      }

      if (!raw || !raw.repoUrl) {
        continue;
      }

      // Match local store for enriched AI diagnostics (markdown, goodPractices, etc.)
      const storeMatch = storeItems.find(
        (s) =>
          s.onChainEvaluationId === idStr ||
          s.feedbackHash === raw.feedbackHash ||
          (s.repoUrl === raw.repoUrl && s.commitSha === raw.commitHash)
      );

      const codeScore = Number(raw.codeScore);
      const uiScore = Number(raw.uiScore);
      const totalScore = codeScore + uiScore;
      const txHash = txMap.get(idStr) || storeMatch?.txHash;

      const item: OnChainLeaderboardItem = {
        id: storeMatch?.id || `onchain-${idStr}`,
        onChainEvaluationId: idStr,
        repoUrl: raw.repoUrl,
        repoName: cleanRepoName(raw.repoUrl),
        commitSha: raw.commitHash,
        codeScore,
        uiScore,
        totalScore,
        feedbackHash: raw.feedbackHash,
        txHash,
        snowtraceUrl: txHash
          ? `https://testnet.snowtrace.io/tx/${txHash}`
          : process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
          ? `https://testnet.snowtrace.io/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`
          : undefined,
        timestamp: Number(raw.timestamp) * 1000,
        createdAt: new Date(Number(raw.timestamp) * 1000).toISOString(),
        recordedBy: raw.recordedBy,
        isFrontendConnected: storeMatch
          ? storeMatch.isFrontendConnected
          : codeScore >= 75 && uiScore >= 75,
        feedback: storeMatch?.feedback,
        goodPractices: storeMatch?.goodPractices,
        badPractices: storeMatch?.badPractices,
        deductionReasons: storeMatch?.deductionReasons,
        architecturalSummary: storeMatch?.architecturalSummary,
        videoName: storeMatch?.videoName,
      };

      items.push(item);
    }

    // Merge live on-chain items with cached/seed store items, deduplicating by ID and repoUrl
    const seenIds = new Set<string>();
    const seenRepos = new Set<string>();
    const mergedList: OnChainLeaderboardItem[] = [];

    // Live on-chain items take highest priority
    for (const item of items) {
      if (item.id) seenIds.add(item.id);
      if (item.repoUrl) seenRepos.add(item.repoUrl.toLowerCase().trim());
      mergedList.push(item);
    }

    // Append cached/seed evaluations that aren't already represented
    for (const storeItem of storeItems) {
      const normRepo = storeItem.repoUrl.toLowerCase().trim();
      if (seenIds.has(storeItem.id) || seenRepos.has(normRepo)) {
        continue;
      }

      seenIds.add(storeItem.id);
      seenRepos.add(normRepo);

      mergedList.push({
        id: storeItem.id,
        onChainEvaluationId: storeItem.onChainEvaluationId || (mergedList.length + 1).toString(),
        repoUrl: storeItem.repoUrl,
        repoName: cleanRepoName(storeItem.repoUrl),
        commitSha: storeItem.commitSha,
        codeScore: storeItem.codeScore,
        uiScore: storeItem.uiScore,
        totalScore: storeItem.codeScore + storeItem.uiScore,
        feedbackHash: storeItem.feedbackHash,
        txHash: storeItem.txHash,
        snowtraceUrl: storeItem.snowtraceUrl,
        timestamp: new Date(storeItem.createdAt).getTime(),
        createdAt: storeItem.createdAt,
        recordedBy: "0x6e2Bb5EcE366a34c4F631e0941A7CD900577E7F1",
        isFrontendConnected: storeItem.isFrontendConnected,
        feedback: storeItem.feedback,
        goodPractices: storeItem.goodPractices,
        badPractices: storeItem.badPractices,
        deductionReasons: storeItem.deductionReasons,
        architecturalSummary: storeItem.architecturalSummary,
        videoName: storeItem.videoName,
      });
    }

    // Sort descending by totalScore (Rank #1 is highest score)
    mergedList.sort((a, b) => b.totalScore - a.totalScore);

    return NextResponse.json({
      success: true,
      count: mergedList.length,
      totalOnChain: totalCount,
      evaluations: mergedList,
      source: "blockchain",
    });
  } catch (err) {
    console.error("[Leaderboard API] On-chain RPC error, falling back to local store:", err);

    // Fallback: format local evaluations into leaderboard format, deduplicating IDs
    const seenFallbackIds = new Set<string>();
    const seenFallbackRepos = new Set<string>();
    const fallbackItems: OnChainLeaderboardItem[] = [];

    for (const item of storeItems) {
      const normRepo = item.repoUrl.toLowerCase().trim();
      if (seenFallbackIds.has(item.id) || seenFallbackRepos.has(normRepo)) {
        continue;
      }
      seenFallbackIds.add(item.id);
      seenFallbackRepos.add(normRepo);

      fallbackItems.push({
        id: item.id,
        onChainEvaluationId: item.onChainEvaluationId || (fallbackItems.length + 1).toString(),
        repoUrl: item.repoUrl,
        repoName: cleanRepoName(item.repoUrl),
        commitSha: item.commitSha,
        codeScore: item.codeScore,
        uiScore: item.uiScore,
        totalScore: item.codeScore + item.uiScore,
        feedbackHash: item.feedbackHash,
        txHash: item.txHash,
        snowtraceUrl: item.snowtraceUrl,
        timestamp: new Date(item.createdAt).getTime(),
        createdAt: item.createdAt,
        recordedBy: "0x6e2Bb5EcE366a34c4F631e0941A7CD900577E7F1",
        isFrontendConnected: item.isFrontendConnected,
        feedback: item.feedback,
        goodPractices: item.goodPractices,
        badPractices: item.badPractices,
        deductionReasons: item.deductionReasons,
        architecturalSummary: item.architecturalSummary,
        videoName: item.videoName,
      });
    }

    fallbackItems.sort((a, b) => b.totalScore - a.totalScore);

    return NextResponse.json({
      success: true,
      count: fallbackItems.length,
      totalOnChain: fallbackItems.length,
      evaluations: fallbackItems,
      source: "fallback",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
