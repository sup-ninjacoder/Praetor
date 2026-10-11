/**
 * app/api/evaluate/route.ts
 *
 * POST /api/evaluate
 *
 * Orchestrates the full Praetor pipeline:
 *   1. Validate request payload
 *   2. Ingest GitHub repository via REST API
 *   3. Evaluate with Gemma 4 (multimodal)
 *   4. Hash the evaluation summary (SHA-256)
 *   5. Record result on Avalanche Fuji via AgentJudgeRegistry
 *   6. Return structured JSON response
 *
 * This route runs exclusively on the server (Next.js App Router).
 * All secrets (GEMINI_API_KEY, DEPLOYER_PRIVATE_KEY, etc.) stay server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { ethers } from "ethers";

import { ingestRepository, fetchRepoContext } from "@/lib/github";
import { evaluateProject, uploadVideoForEvaluation, type EvaluationResult } from "@/lib/gemmaEvaluator";
import { getRegistryContract } from "@/lib/contractClient";
import { saveEvaluation } from "@/lib/evaluationsStore";

/** Prevent Vercel serverless function from timing out during multimodal Gemini/Avalanche operations */
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of screenshots accepted per request. */
const MAX_SCREENSHOTS = 5;

/**
 * Maximum Base64 length per screenshot.
 * Base64 of a 5MB image ≈ 6.8MB of characters — hard cap at 10MB chars.
 */
const MAX_SCREENSHOT_B64_LENGTH = 10_000_000;

/** Maximum allowed length of the repoUrl field. */
const MAX_REPO_URL_LENGTH = 300;

/**
 * Regex that matches valid GitHub repository URLs.
 * Accepts:
 *  - https://github.com/owner/repo
 *  - https://github.com/owner/repo/tree/branch
 */
const GITHUB_URL_REGEX =
  /^https?:\/\/github\.com\/[A-Za-z0-9_.\-]+\/[A-Za-z0-9_.\-]+(?:\/tree\/[^\s]*)?$/;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface EvaluateRequestBody {
  repoUrl: string;
  screenshots?: string[];
  videoName?: string;
}

interface EvaluateSuccessResponse {
  success: true;
  id: string;
  txHash: string;
  snowtraceUrl: string;
  onChainEvaluationId: string;
  feedbackHash: string;
  evaluation: EvaluationResult;
  meta: {
    repoId: string;
    commitSha: string;
    ref: string;
    screenshotsProvided: number;
    filesAnalyzed: number;
    videoName?: string;
  };
}

interface EvaluatePartialResponse {
  success: false;
  id: string;
  onChainError: string;
  feedbackHash: string;
  evaluation: EvaluationResult;
  meta: {
    repoId: string;
    commitSha: string;
    ref: string;
    screenshotsProvided: number;
    filesAnalyzed: number;
    videoName?: string;
  };
}

interface EvaluateErrorResponse {
  success: false;
  error: string;
  stage: "validation" | "ingestion" | "evaluation" | "hashing" | "blockchain";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic SHA-256 hex digest of an evaluation summary.
 *
 * The summary string is constructed so it covers every semantically
 * significant field — changing any score, flag, or word of feedback
 * produces a completely different hash, making the on-chain fingerprint
 * tamper-evident.
 *
 * Format (newline-separated for human readability in debug logs):
 *   codeScore:<N>
 *   uiScore:<N>
 *   isFrontendConnected:<true|false>
 *   feedback:<raw feedback text>
 */
function computeFeedbackHash(evaluation: EvaluationResult, repoUrl: string, commitSha: string): string {
  const summary = [
    `repoUrl:${repoUrl}`,
    `commitSha:${commitSha}`,
    `codeScore:${evaluation.codeScore}`,
    `uiScore:${evaluation.uiScore}`,
    `isFrontendConnected:${evaluation.isFrontendConnected}`,
    `feedback:${evaluation.feedback}`,
  ].join("\n");

  return "0x" + createHash("sha256").update(summary, "utf8").digest("hex");
}

/**
 * Validate the request body and return a normalised payload or an error.
 */
function validatePayload(body: unknown): {
  ok: true;
  data: {
    repoUrl: string;
    screenshots: string[];
    videoName?: string;
  };
} | {
  ok: false;
  message: string;
} {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Request body must be a JSON object." };
  }

  const { repoUrl, screenshots, videoName } = body as Record<string, unknown>;

  // ── repoUrl ───────────────────────────────────────────────────────────────
  if (typeof repoUrl !== "string" || !repoUrl.trim()) {
    return { ok: false, message: "`repoUrl` is required and must be a non-empty string." };
  }

  if (repoUrl.length > MAX_REPO_URL_LENGTH) {
    return {
      ok: false,
      message: `\`repoUrl\` exceeds the maximum allowed length of ${MAX_REPO_URL_LENGTH} characters.`,
    };
  }

  if (!GITHUB_URL_REGEX.test(repoUrl.trim())) {
    return {
      ok: false,
      message:
        "`repoUrl` must be a valid GitHub repository URL. " +
        "Example: https://github.com/owner/repo",
    };
  }

  // ── screenshots (optional) ────────────────────────────────────────────────
  const safeScreenshots: string[] = [];

  if (screenshots !== undefined) {
    if (!Array.isArray(screenshots)) {
      return { ok: false, message: "`screenshots` must be an array of Base64 strings." };
    }

    if (screenshots.length > MAX_SCREENSHOTS) {
      return {
        ok: false,
        message: `A maximum of ${MAX_SCREENSHOTS} screenshots are allowed per request.`,
      };
    }

    for (let i = 0; i < screenshots.length; i++) {
      const s = screenshots[i];

      if (typeof s !== "string") {
        return { ok: false, message: `screenshots[${i}] must be a string.` };
      }

      // Strip data URI prefix for size check and character validation
      const raw = s.replace(/^data:image\/[a-zA-Z0-9.-]+;base64,/, "");

      if (raw.length > MAX_SCREENSHOT_B64_LENGTH) {
        return {
          ok: false,
          message: `screenshots[${i}] exceeds the maximum allowed size (10 MB Base64).`,
        };
      }

      // Basic Base64 character validation
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) {
        return {
          ok: false,
          message: `screenshots[${i}] contains invalid Base64 characters.`,
        };
      }

      safeScreenshots.push(s);
    }
  }

  const safeVideoName = typeof videoName === "string" && videoName.trim() ? videoName.trim().slice(0, 100) : undefined;

  return {
    ok: true,
    data: {
      repoUrl: repoUrl.trim(),
      screenshots: safeScreenshots,
      videoName: safeVideoName,
    },
  };
}

/**
 * Build a plain-language error response at a named pipeline stage.
 */
function stageError(
  stage: EvaluateErrorResponse["stage"],
  message: string,
  status = 500
): NextResponse<EvaluateErrorResponse> {
  return NextResponse.json<EvaluateErrorResponse>(
    { success: false, error: message, stage },
    { status }
  );
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest
): Promise<NextResponse<EvaluateSuccessResponse | EvaluatePartialResponse | EvaluateErrorResponse>> {

  const contentType = request.headers.get("content-type") || "";
  let repoUrl = "";
  let screenshots: string[] = [];
  let videoName: string | undefined = undefined;
  let videoFile: File | null = null;

  // ── Stage 0 & 1: Parse & Validate Payload ───────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      repoUrl = ((formData.get("repoUrl") as string) || "").trim();

      const imageFiles: File[] = [];

      // Check all formData entries for uploaded files (video or images)
      for (const [key, value] of formData.entries()) {
        if (value && typeof value === "object" && "size" in value && "type" in value) {
          const file = value as File;
          if (file.size > 0) {
            if (file.type.startsWith("video/")) {
              videoFile = file;
              videoName = file.name;
            } else if (file.type.startsWith("image/")) {
              imageFiles.push(file);
            }
          }
        }
      }

      // Check for screenshots provided as serialized JSON
      const rawScreenshots = formData.get("screenshots");
      if (typeof rawScreenshots === "string") {
        try {
          const parsed = JSON.parse(rawScreenshots);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === "string") screenshots.push(item);
            }
          }
        } catch {}
      }

      // Convert uploaded image files (up to 4 images, 10MB each) to inline base64 data parts
      for (const img of imageFiles.slice(0, 4)) {
        if (img.size <= 10 * 1024 * 1024) {
          const buffer = Buffer.from(await img.arrayBuffer());
          const mime = img.type || "image/png";
          screenshots.push(`data:${mime};base64,${buffer.toString("base64")}`);
        }
      }

      if (!videoName && screenshots.length > 0) {
        videoName = `${screenshots.length} Screenshot${screenshots.length > 1 ? "s" : ""}`;
      }
    } catch {
      return stageError("validation", "Invalid multipart form data in request body.", 400);
    }

    if (!repoUrl) {
      return stageError("validation", "`repoUrl` is required.", 400);
    }

    if (!GITHUB_URL_REGEX.test(repoUrl)) {
      return stageError(
        "validation",
        "`repoUrl` must be a valid GitHub repository URL. Example: https://github.com/owner/repo",
        400
      );
    }
  } else {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return stageError("validation", "Invalid JSON in request body.", 400);
    }

    const validation = validatePayload(rawBody);
    if (!validation.ok) {
      return stageError("validation", validation.message, 400);
    }

    repoUrl = validation.data.repoUrl;
    screenshots = validation.data.screenshots;
    videoName = validation.data.videoName;
  }

  const evaluationId = `eval-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  console.log(`[Praetor] ▶ Evaluation started for: ${repoUrl} [${evaluationId}]`);
  console.log(`[Praetor]   Screenshots: ${screenshots.length}, Video: ${videoName || "none"}`);

  // Optional Video Upload via Google Gen AI Files API
  let videoFileUri: string | undefined = undefined;
  let videoMimeType: string | undefined = undefined;

  if (videoFile && videoFile.size > 0) {
    try {
      console.log(`[Praetor] ⏳ Uploading demo video "${videoFile.name}" to Gemini Files API...`);
      const buffer = Buffer.from(await videoFile.arrayBuffer());
      const uploadRes = await uploadVideoForEvaluation(
        buffer,
        videoFile.type || "video/mp4",
        videoFile.name
      );
      videoFileUri = uploadRes.fileUri;
      videoMimeType = uploadRes.mimeType;
      console.log(`[Praetor] ✅ Video active in Gemini Files API: ${videoFileUri}`);
    } catch (err) {
      console.warn(`[Praetor] ⚠️ Video upload to Files API failed, continuing with code review:`, err);
    }
  }

  // ── Stage 2: Ingest repository ────────────────────────────────────────────
  let repoContext: Awaited<ReturnType<typeof fetchRepoContext>>;
  try {
    console.log(`[Praetor] ⏳ Fetching repo context...`);
    repoContext = await fetchRepoContext(repoUrl);
    console.log(
      `[Praetor] ✅ Repo ingested — ${repoContext.totalFilesAnalyzed} files analyzed, ` +
      `commit ${repoContext.commitSha.slice(0, 7)}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Praetor] ❌ Ingestion failed:", message);
    return stageError(
      "ingestion",
      `Failed to fetch repository from GitHub: ${message}`,
      502
    );
  }

  // ── Stage 3: Evaluate with Multimodal Model ───────────────────────────────
  let evaluation: EvaluationResult;
  try {
    console.log(`[Praetor] ⏳ Running Multimodal Evaluation (video: ${Boolean(videoFileUri)})...`);
    evaluation = await evaluateProject({
      codebaseContext: repoContext.aggregatedSource,
      screenshotsBase64: screenshots,
      videoFileUri,
      videoMimeType,
    });
    console.log(
      `[Praetor] ✅ Evaluation complete — ` +
      `code: ${evaluation.codeScore}, ui: ${evaluation.uiScore}, ` +
      `connected: ${evaluation.isFrontendConnected}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Praetor] ❌ Evaluation failed:", message);
    return stageError(
      "evaluation",
      `AI evaluation failed: ${message}`,
      502
    );
  }

  // ── Stage 4: Compute feedback hash ────────────────────────────────────────
  let feedbackHash: string;
  try {
    feedbackHash = computeFeedbackHash(evaluation, repoUrl, repoContext.commitSha);
    console.log(`[Praetor] 🔑 Feedback hash: ${feedbackHash.slice(0, 20)}...`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return stageError("hashing", `Failed to compute feedback hash: ${message}`);
  }

  // Shared meta for both success and partial responses
  const meta = {
    repoId: repoContext.repoId,
    commitSha: repoContext.commitSha,
    ref: repoContext.ref,
    screenshotsProvided: screenshots.length,
    filesAnalyzed: repoContext.totalFilesAnalyzed,
    videoName,
  };

  // ── Stage 5: Record on-chain ───────────────────────────────────────────────
  try {
    console.log(`[Praetor] ⏳ Writing to AgentJudgeRegistry on Fuji...`);

    const contract = getRegistryContract();

    // Clamp scores to uint8 range [0, 100] as an extra safety layer
    const codeScore = Math.min(255, Math.max(0, Math.round(evaluation.codeScore)));
    const uiScore   = Math.min(255, Math.max(0, Math.round(evaluation.uiScore)));

    const tx: ethers.ContractTransactionResponse = await contract.recordEvaluation(
      repoUrl,
      repoContext.commitSha,
      codeScore,
      uiScore,
      feedbackHash
    );

    console.log(`[Praetor] 📡 Tx submitted: ${tx.hash}`);

    // Wait for 1 block confirmation on Fuji (~2 seconds)
    const receipt = await tx.wait(1);

    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction reverted. Receipt: ${JSON.stringify(receipt)}`);
    }

    // Extract the evaluationId from the EvaluationRecorded event
    let onChainEvaluationId = "unknown";
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (parsed?.name === "EvaluationRecorded") {
          onChainEvaluationId = parsed.args[0].toString();
          break;
        }
      } catch {
        // Log may belong to another contract — skip
      }
    }

    console.log(
      `[Praetor] ✅ On-chain — evaluationId: ${onChainEvaluationId}, ` +
      `block: ${receipt.blockNumber}`
    );

    // Save to persistent evaluations store
    saveEvaluation({
      id: evaluationId,
      repoUrl,
      repoId: repoContext.repoId,
      commitSha: repoContext.commitSha,
      ref: repoContext.ref,
      codeScore: evaluation.codeScore,
      uiScore: evaluation.uiScore,
      totalScore: Math.round(evaluation.codeScore * 0.6 + evaluation.uiScore * 0.4),
      isFrontendConnected: evaluation.isFrontendConnected,
      feedback: evaluation.feedback,
      goodPractices: evaluation.goodPractices,
      badPractices: evaluation.badPractices,
      deductionReasons: evaluation.deductionReasons,
      architecturalSummary: evaluation.architecturalSummary,
      feedbackHash,
      txHash: tx.hash,
      snowtraceUrl: `https://testnet.snowtrace.io/tx/${tx.hash}`,
      onChainEvaluationId,
      filesAnalyzed: repoContext.totalFilesAnalyzed,
      videoName,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json<EvaluateSuccessResponse>(
      {
        success: true,
        id: evaluationId,
        txHash: tx.hash,
        snowtraceUrl: `https://testnet.snowtrace.io/tx/${tx.hash}`,
        onChainEvaluationId,
        feedbackHash,
        evaluation,
        meta,
      },
      { status: 200 }
    );

  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);

    let onChainError: string;
    if (rawMessage.includes("insufficient funds") || rawMessage.includes("gas")) {
      onChainError =
        `On-chain recording failed — insufficient AVAX for gas. ` +
        `Fund the deployer wallet at https://faucet.avax.network/ and retry. ` +
        `(Raw: ${rawMessage.slice(0, 200)})`;
    } else if (rawMessage.includes("CONTRACT_ADDRESS")) {
      onChainError =
        `On-chain recording failed — contract address not configured. ` +
        `Set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local after deploying.`;
    } else if (rawMessage.includes("PRIVATE_KEY") || rawMessage.includes("FUJI_RPC")) {
      onChainError =
        `On-chain recording failed — missing Web3 environment variables. ` +
        `Check DEPLOYER_PRIVATE_KEY and FUJI_RPC_URL in .env.local.`;
    } else {
      onChainError = `On-chain recording failed: ${rawMessage.slice(0, 300)}`;
    }

    console.error("[Praetor] ⚠️ Blockchain step failed (evaluation still valid):", rawMessage);

    // Still persist the evaluated record for viewing
    saveEvaluation({
      id: evaluationId,
      repoUrl,
      repoId: repoContext.repoId,
      commitSha: repoContext.commitSha,
      ref: repoContext.ref,
      codeScore: evaluation.codeScore,
      uiScore: evaluation.uiScore,
      totalScore: Math.round(evaluation.codeScore * 0.6 + evaluation.uiScore * 0.4),
      isFrontendConnected: evaluation.isFrontendConnected,
      feedback: evaluation.feedback,
      goodPractices: evaluation.goodPractices,
      badPractices: evaluation.badPractices,
      deductionReasons: evaluation.deductionReasons,
      architecturalSummary: evaluation.architecturalSummary,
      feedbackHash,
      onChainError,
      filesAnalyzed: repoContext.totalFilesAnalyzed,
      videoName,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json<EvaluatePartialResponse>(
      {
        success: false,
        id: evaluationId,
        onChainError,
        feedbackHash,
        evaluation,
        meta,
      },
      { status: 200 }
    );
  }
}

// ---------------------------------------------------------------------------
// Method guards — reject non-POST requests with clear messages
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: "Method not allowed. Use POST /api/evaluate.",
      example: {
        method: "POST",
        body: {
          repoUrl: "https://github.com/owner/repo",
          screenshots: ["<base64-encoded-png>"],
        },
      },
    },
    { status: 405 }
  );
}
