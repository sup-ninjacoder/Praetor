/**
 * gemmaEvaluator.ts
 *
 * Multimodal Video Analysis & Deep Code Review Engine for Praetor.
 *
 * Features:
 *  - Senior Principal Engineer persona
 *  - Multimodal video analysis via @google/genai Files API
 *  - Strict JSON schema enforcement with granular evaluation categories:
 *    * codeScore (0-100)
 *    * uiScore (0-100)
 *    * goodPractices (2 sentences on architecture & security)
 *    * badPractices (2 sentences on anti-patterns & flaws)
 *    * deductionReasons (specific reasons why marks were lost)
 *    * architecturalSummary (data flow and topology overview)
 */

import { GoogleGenAI, type Part } from "@google/genai";
import fs from "fs";
import os from "os";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvaluationResult {
  codeScore: number;
  uiScore: number;
  goodPractices: string;
  badPractices: string;
  deductionReasons: string;
  architecturalSummary: string;
  feedback: string;
  isFrontendConnected: boolean;
}

export interface EvaluationInput {
  codebaseContext: string;
  screenshotsBase64?: string[];
  screenshotMimeType?: "image/png" | "image/jpeg" | "image/webp";
  videoFileUri?: string;
  videoMimeType?: string;
}

// ---------------------------------------------------------------------------
// SDK Singleton
// ---------------------------------------------------------------------------

let _client: GoogleGenAI | null = null;

export function getClient(): GoogleGenAI {
  if (_client) return _client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[Praetor] GEMINI_API_KEY is not set. Add it to agent-judge/.env.local."
    );
  }

  _client = new GoogleGenAI({ apiKey });
  return _client;
}

function getModelId(): string {
  const modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  return modelName;
}



// ---------------------------------------------------------------------------
// Video Upload & Processing via Files API
// ---------------------------------------------------------------------------

/**
 * Uploads a video file buffer to the Gemini Files API and waits until ACTIVE.
 */
export async function uploadVideoForEvaluation(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<{ fileUri: string; mimeType: string }> {
  const client = getClient();
  const tempPath = path.join(
    os.tmpdir(),
    `praetor-video-${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`
  );

  try {
    await fs.promises.writeFile(tempPath, buffer);
    console.log(`[VideoEngine] Uploading ${filename} (${(buffer.length / (1024 * 1024)).toFixed(1)} MB) to Gemini Files API...`);

    const uploadResult = await client.files.upload({
      file: tempPath,
      config: {
        mimeType,
        displayName: filename,
      },
    });

    const fileName = uploadResult.name;
    if (!fileName) {
      throw new Error("Gemini Files API upload succeeded but returned no file name.");
    }

    console.log(`[VideoEngine] File uploaded: ${fileName}, checking processing status...`);

    // Poll until file state is ACTIVE
    let fileInfo = uploadResult;
    let attempts = 0;
    while (fileInfo.state === "PROCESSING" && attempts < 25) {
      await new Promise((r) => setTimeout(r, 2000));
      fileInfo = await client.files.get({ name: fileName });
      attempts++;
    }

    if (fileInfo.state === "FAILED") {
      throw new Error(`Video processing failed in Gemini API: ${fileName}`);
    }

    const fileUri = fileInfo.uri;
    if (!fileUri) {
      throw new Error(`Gemini Files API returned no URI for file: ${fileName}`);
    }

    console.log(`[VideoEngine] ✅ Video is ready for inference: ${fileUri}`);
    return {
      fileUri,
      mimeType: fileInfo.mimeType || mimeType,
    };
  } finally {
    // Clean up temporary local disk file
    fs.promises.unlink(tempPath).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// System Prompt & Instructions
// ---------------------------------------------------------------------------

function getSystemInstruction(hasVideo: boolean, hasScreenshots: boolean): string {
  let mediaDescription = "and its implementation architecture";
  if (hasVideo) {
    mediaDescription = "and the accompanying demo video walkthrough";
  } else if (hasScreenshots) {
    mediaDescription = "and the accompanying UI interface screenshots";
  }

  return `\
You are a highly critical Senior Principal Engineer evaluating a hackathon submission. You will analyze the provided Smart Context codebase string ${mediaDescription}.

Your evaluation must be rigorous, precise, and uncompromising. You will assess code architecture, smart contracts, backend robustness, and cross-reference them with the visual presentation.

CRITICAL INSTRUCTION:
You MUST respond with ONLY a single valid JSON object matching the exact schema below. No markdown fences outside the JSON, no preamble, and no trailing commentary.

JSON SCHEMA:
{
  "codeScore": <integer 0-100>,
  "uiScore": <integer 0-100>,
  "goodPractices": "<exactly 2 sentences highlighting what is well-architected, modular, or secure>",
  "badPractices": "<exactly 2 sentences identifying anti-patterns, bloat, missing error handling, or security flaws>",
  "deductionReasons": "<concise explanation specifically detailing why marks were lost across UI and Code>",
  "architecturalSummary": "<brief 2-3 sentence overview of the data flow and system topology>"
}

SCORING CRITERIA:
- codeScore (0-100): Code organization, typing, security, gas efficiency (for smart contracts), error boundaries, and dependency discipline.
- uiScore (0-100): User experience clarity, UI responsiveness, visual hierarchy, polished states, and fidelity between demonstrated features and codebase implementation.
`;
}

// ---------------------------------------------------------------------------
// Parts Builder
// ---------------------------------------------------------------------------

function buildParts(input: EvaluationInput): Part[] {
  const parts: Part[] = [];

  // 1. Codebase Smart Context
  parts.push({
    text: `## SMART CONTEXT CODEBASE\n\n${input.codebaseContext}`,
  });

  // 2. Multimodal Demo Video (via Gemini Files API)
  if (input.videoFileUri) {
    parts.push({
      fileData: {
        fileUri: input.videoFileUri,
        mimeType: input.videoMimeType || "video/mp4",
      },
    });
    parts.push({
      text: "## DEMO VIDEO ATTACHMENT\nA high-fidelity demonstration video is attached above. Inspect user interactions, visual responsiveness, and verify whether demonstrated features match the codebase logic.",
    });
  }

  // 3. UI Screenshots (if present, up to 4 images)
  if (input.screenshotsBase64 && input.screenshotsBase64.length > 0) {
    for (let i = 0; i < Math.min(input.screenshotsBase64.length, 4); i++) {
      let b64 = input.screenshotsBase64[i];
      let mime = input.screenshotMimeType ?? "image/png";
      const match = b64.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.*)$/);
      if (match) {
        mime = match[1] as "image/png" | "image/jpeg" | "image/webp";
        b64 = match[2];
      }
      parts.push({
        inlineData: {
          mimeType: mime,
          data: b64,
        },
      });
    }
    parts.push({
      text: "## UI SCREENSHOTS ATTACHMENT\nHigh-fidelity project interface screenshots are attached above. Inspect visual hierarchy, UX layout, design polish, and verify alignment with codebase styling and components.",
    });
  }

  // 4. Prompt Directive
  let directiveContext = "Analyze the provided codebase architecture and implementation.";
  if (input.videoFileUri) {
    directiveContext = "Analyze the provided codebase and accompanying demo video walkthrough.";
  } else if (input.screenshotsBase64 && input.screenshotsBase64.length > 0) {
    directiveContext = "Analyze the provided codebase and accompanying UI interface screenshots.";
  }

  parts.push({
    text:
      "## VERDICT DIRECTIVE\n" +
      `${directiveContext} Return ONLY the strict JSON object with codeScore, uiScore, goodPractices, badPractices, deductionReasons, and architecturalSummary.`,
  });

  return parts;
}

// ---------------------------------------------------------------------------
// Response Parser
// ---------------------------------------------------------------------------

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }

  return raw.trim();
}

function parseEvaluationResult(rawText: string): EvaluationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(rawText));
  } catch {
    throw new Error(
      `[Praetor] Gemini API returned non-JSON output. Raw response:\n${rawText.slice(0, 500)}`
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("[Praetor] Gemini API response was not a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;

  const codeScore = Number(obj.codeScore);
  const uiScore = Number(obj.uiScore);
  const goodPractices = typeof obj.goodPractices === "string" ? obj.goodPractices.trim() : "Clean code organization and modular interfaces.";
  const badPractices = typeof obj.badPractices === "string" ? obj.badPractices.trim() : "Error handling and edge-case boundaries require hardening.";
  const deductionReasons = typeof obj.deductionReasons === "string" ? obj.deductionReasons.trim() : "Deductions applied for missing test fixtures and unhandled error states.";
  const architecturalSummary = typeof obj.architecturalSummary === "string" ? obj.architecturalSummary.trim() : "Client-server architecture communicating via REST APIs with smart contract verification.";

  const isFrontendConnected = uiScore >= 20;

  // Synthesize legacy feedback markdown for backward compatibility
  const feedback = [
    `### Architectural Flow\n${architecturalSummary}`,
    `### Good Practices\n${goodPractices}`,
    `### Anti-Patterns & Bad Practices\n${badPractices}`,
    `### Score Deductions\n${deductionReasons}`,
  ].join("\n\n");

  return {
    codeScore: Math.min(100, Math.max(0, Math.round(Number.isFinite(codeScore) ? codeScore : 50))),
    uiScore: Math.min(100, Math.max(0, Math.round(Number.isFinite(uiScore) ? uiScore : 50))),
    goodPractices,
    badPractices,
    deductionReasons,
    architecturalSummary,
    feedback,
    isFrontendConnected,
  };
}

// ---------------------------------------------------------------------------
// Evaluation Execution
// ---------------------------------------------------------------------------

export async function evaluateProject(input: EvaluationInput): Promise<EvaluationResult> {
  const client = getClient();
  const hasVideo = Boolean(input.videoFileUri);
  const hasScreenshots = Boolean(input.screenshotsBase64 && input.screenshotsBase64.length > 0);
  const modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  console.log(
    `[Praetor] Invoking multimodal model: ${modelName} (hasVideo: ${hasVideo}, hasScreenshots: ${hasScreenshots})`
  );

  const parts = buildParts(input);
  const systemInstruction = getSystemInstruction(hasVideo, hasScreenshots);
  let rawText = "";

  try {
    const response = await client.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      config: {
        systemInstruction,
        temperature: 0,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        candidateCount: 1,
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error("[Praetor] Gemini API returned no candidates.");
    }

    rawText =
      candidate.content?.parts
        ?.filter((p: Part) => "text" in p)
        .map((p: Part) => ("text" in p ? p.text : ""))
        .join("") ?? "";

    if (!rawText) {
      throw new Error("[Praetor] Model response contained no text content.");
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("[Praetor]")) throw err;
    throw new Error(
      `[Praetor] Gemini API call failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return parseEvaluationResult(rawText);
}
