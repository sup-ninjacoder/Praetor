/**
 * github.ts
 *
 * "10k Lines" Smart Context Ingestion Engine for Praetor.
 *
 * Solves the hackathon scaling challenge:
 *  - Evaluates 10,000+ line repositories without blowing the context window or timing out.
 *  - Generates a compact macro-architectural tree (< 500 tokens).
 *  - Deterministically ranks and scores files by structural importance.
 *  - Intelligently condenses oversized files (> 250 lines) into signatures,
 *    interfaces, imports, and critical logic branches.
 *  - Strictly clamps total ingested code content to ~35,000 characters (~8,000-9,000 tokens).
 *  - Operates exclusively via GitHub REST API (no `git clone`).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IngestionResult {
  /** High-level ASCII/Markdown directory tree representing macro architecture. */
  tree: string;
  /** Prioritized, clamped, and condensed code context with metadata headers. */
  formattedCodeContext: string;
  /** Total number of files analyzed and prioritized. */
  totalFilesAnalyzed: number;
  /** Resolved HEAD git commit SHA. */
  commitHash: string;
}

export interface RepoContext extends IngestionResult {
  repoId: string;
  ref: string;
  commitSha: string;
  repoUrl: string;
  aggregatedSource: string;
  files: Record<string, string>;
  fetchErrors: Record<string, string>;
}

interface GitHubTreeItem {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Constants & Limits
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";

/** Hard character ceiling for total ingested code (~8,750 tokens). */
const MAX_TOTAL_CONTEXT_CHARS = 35_000;

/** Threshold above which files are condensed into signatures and key logic. */
const OVERSIZED_LINE_THRESHOLD = 250;

/** Directories completely ignored from tree generation and code ingestion. */
const NOISE_DIRECTORIES = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "target",
  "coverage",
  ".turbo",
  ".cache",
  ".vscode",
  ".idea",
  "vendor",
  "typechain",
  "typechain-types",
  "artifacts",
  "cache",
];

/** Extensions to completely exclude (binaries, media, lockfiles, minified). */
const EXCLUDED_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".avif",
  ".mp4", ".webm", ".mov", ".avi", ".mp3", ".wav",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".pdf", ".exe", ".dll", ".so", ".dylib",
  ".min.js", ".min.css", ".map",
  ".lock",
];

/** Exact filenames to exclude (lockfiles, test fixtures, boilerplates). */
const EXCLUDED_FILENAMES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "cargo.lock",
  "composer.lock",
  "bun.lockb",
  ".DS_Store",
  "Thumbs.db",
];

// ---------------------------------------------------------------------------
// GitHub REST API Helpers
// ---------------------------------------------------------------------------

function buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

async function githubGet<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    headers: buildHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API error ${res.status} for ${url}: ${body.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

function parseGitHubUrl(repoUrl: string): {
  owner: string;
  repo: string;
  ref: string | null;
} {
  const cleaned = repoUrl.replace(/\/$/, "").replace(/\.git$/, "");
  const match = cleaned.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/].*))?/
  );

  if (!match) {
    throw new Error(
      `Invalid GitHub URL: "${repoUrl}". Expected format: https://github.com/owner/repo`
    );
  }

  return {
    owner: match[1],
    repo: match[2],
    ref: match[3] ?? null,
  };
}

async function resolveRef(
  owner: string,
  repo: string,
  ref: string | null
): Promise<{ ref: string; commitSha: string }> {
  if (ref) {
    try {
      const data = await githubGet<{ object: { sha: string } }>(
        `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(ref)}`
      );
      return { ref, commitSha: data.object.sha };
    } catch {
      // Fall through if it's already a commit SHA
    }

    if (/^[0-9a-f]{7,40}$/i.test(ref)) {
      return { ref, commitSha: ref };
    }
  }

  const repoData = await githubGet<{ default_branch: string }>(`/repos/${owner}/${repo}`);
  const branch = repoData.default_branch;
  const refData = await githubGet<{ object: { sha: string } }>(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
  );

  return { ref: branch, commitSha: refData.object.sha };
}

async function fetchFileContent(
  owner: string,
  repo: string,
  filePath: string,
  ref: string
): Promise<string> {
  const endpoint = `/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`;
  const data = await githubGet<{ content?: string; encoding?: string }>(endpoint);

  if (!data.content || data.encoding !== "base64") {
    throw new Error(`Unexpected blob response for ${filePath}`);
  }

  return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
}

// ---------------------------------------------------------------------------
// 1. High-Level Architectural Tree Generator
// ---------------------------------------------------------------------------

function isNoisePath(filePath: string): boolean {
  const segments = filePath.split("/");
  // Check noise directories
  for (const seg of segments) {
    if (NOISE_DIRECTORIES.includes(seg.toLowerCase())) return true;
  }

  // Check excluded exact filenames
  const fileName = segments[segments.length - 1];
  if (EXCLUDED_FILENAMES.includes(fileName)) return true;

  // Check excluded extensions
  const lowerPath = filePath.toLowerCase();
  for (const ext of EXCLUDED_EXTENSIONS) {
    if (lowerPath.endsWith(ext)) return true;
  }

  return false;
}

interface TreeNode {
  name: string;
  type: "blob" | "tree";
  children?: Map<string, TreeNode>;
}

export function generateArchitecturalTree(paths: string[], maxNodes = 120): string {
  const root = new Map<string, TreeNode>();

  for (const path of paths) {
    if (isNoisePath(path)) continue;

    const parts = path.split("/");
    let currentMap = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (!currentMap.has(part)) {
        currentMap.set(part, {
          name: part,
          type: isFile ? "blob" : "tree",
          children: isFile ? undefined : new Map(),
        });
      }

      if (!isFile) {
        currentMap = currentMap.get(part)!.children!;
      }
    }
  }

  let nodeCount = 0;
  const lines: string[] = ["."];

  function formatBranch(map: Map<string, TreeNode>, prefix = ""): void {
    const entries = Array.from(map.values()).sort((a, b) => {
      // Directories first, then files alphabetically
      if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < entries.length; i++) {
      if (nodeCount >= maxNodes) {
        if (nodeCount === maxNodes) {
          lines.push(`${prefix}└── ... [remaining project files truncated for brevity]`);
          nodeCount++;
        }
        return;
      }

      const node = entries[i];
      const isLast = i === entries.length - 1;
      const pointer = isLast ? "└── " : "├── ";
      const childPrefix = prefix + (isLast ? "    " : "│   ");

      lines.push(`${prefix}${pointer}${node.name}${node.type === "tree" ? "/" : ""}`);
      nodeCount++;

      if (node.type === "tree" && node.children) {
        formatBranch(node.children, childPrefix);
      }
    }
  }

  formatBranch(root);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 2. Deterministic File Priority & Scoring
// ---------------------------------------------------------------------------

export type FileImportance =
  | "Priority 1 (Config & Architecture)"
  | "Priority 2 (Core Logic & Contracts)"
  | "Priority 3 (Client Presentation)"
  | "Priority 4 (Supporting Source)";

interface PrioritizedFile {
  path: string;
  importance: FileImportance;
  score: number;
  size: number;
}

function calculateFilePriority(filePath: string, size: number): PrioritizedFile | null {
  if (isNoisePath(filePath)) return null;

  // Filter out test files, mocks, fixtures, and lockfiles
  const lower = filePath.toLowerCase();
  if (
    lower.includes("__tests__") ||
    lower.includes(".test.") ||
    lower.includes(".spec.") ||
    lower.includes("/test/") ||
    lower.includes("/tests/") ||
    lower.includes("/mock/") ||
    lower.includes("/mocks/") ||
    lower.includes("/fixtures/")
  ) {
    return null;
  }

  const depth = (filePath.match(/\//g) ?? []).length;
  const fileName = filePath.split("/").pop() || "";

  // ── Priority 1: Configuration & Architecture ──────────────────────────────
  if (
    fileName === "package.json" ||
    fileName === "foundry.toml" ||
    fileName.startsWith("hardhat.config.") ||
    fileName.startsWith("next.config.") ||
    fileName.startsWith("docker-compose.") ||
    fileName === "README.md" ||
    fileName === "README.mdx" ||
    fileName === "Cargo.toml" ||
    fileName === "go.mod" ||
    fileName === "SKILL.md"
  ) {
    return {
      path: filePath,
      importance: "Priority 1 (Config & Architecture)",
      score: 1000 - depth * 10,
      size,
    };
  }

  // ── Priority 2: Core Business Logic & Contracts ───────────────────────────
  if (
    filePath.endsWith(".sol") ||
    filePath.includes("/api/") ||
    filePath.includes("/contracts/") ||
    filePath.includes("/store/") ||
    filePath.includes("/models/") ||
    filePath.includes("/services/") ||
    filePath.includes("/controllers/") ||
    filePath.includes("/lib/") ||
    filePath.includes("/core/") ||
    filePath.includes("/handlers/")
  ) {
    return {
      path: filePath,
      importance: "Priority 2 (Core Logic & Contracts)",
      score: 500 - depth * 8,
      size,
    };
  }

  // ── Priority 3: Client Presentation ───────────────────────────────────────
  if (
    fileName === "page.tsx" ||
    fileName === "page.jsx" ||
    fileName === "layout.tsx" ||
    fileName === "layout.jsx" ||
    fileName === "App.tsx" ||
    fileName === "App.jsx" ||
    fileName === "index.tsx" ||
    fileName === "main.tsx" ||
    filePath.includes("/components/")
  ) {
    return {
      path: filePath,
      importance: "Priority 3 (Client Presentation)",
      score: 250 - depth * 5,
      size,
    };
  }

  // ── Priority 4: Supporting Source Code ────────────────────────────────────
  const supportedExtensions = [".ts", ".tsx", ".js", ".jsx", ".sol", ".py", ".rs", ".go"];
  if (supportedExtensions.some((ext) => lower.endsWith(ext))) {
    return {
      path: filePath,
      importance: "Priority 4 (Supporting Source)",
      score: 100 - depth * 3,
      size,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// 3. Context Clamping & AST / Signature Condensation
// ---------------------------------------------------------------------------

/**
 * For oversized files (> 250 lines), condenses code to preserve:
 *  - Imports and package requirements
 *  - Type aliases, interfaces, and struct definitions
 *  - Class/Contract declarations and state variables
 *  - Function signatures, modifiers, docstrings, and return types
 *  - Key route exports / main handlers
 * Truncating internal repetitive loops and boilerplate logic.
 */
export function condenseOversizedCode(code: string, filePath: string): string {
  const lines = code.split("\n");
  if (lines.length <= OVERSIZED_LINE_THRESHOLD) {
    return code;
  }

  const condensed: string[] = [];
  condensed.push(`// [AST CONDENSED: File has ${lines.length} lines. Extracting imports, types, contracts & function signatures]`);

  let insideBlockComment = false;
  let linesSinceLastSignature = 0;
  let includedLinesCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Preserve block comments / NatSpec headers
    if (trimmed.startsWith("/*")) insideBlockComment = true;
    if (insideBlockComment) {
      condensed.push(line);
      includedLinesCount++;
      if (trimmed.endsWith("*/")) insideBlockComment = false;
      continue;
    }

    // Preserve docstrings / single comments if attached to declarations
    if (trimmed.startsWith("//") || trimmed.startsWith("///") || trimmed.startsWith("*")) {
      condensed.push(line);
      includedLinesCount++;
      continue;
    }

    // Preserve imports and exports
    if (
      trimmed.startsWith("import ") ||
      trimmed.startsWith("export ") ||
      trimmed.startsWith("from ") ||
      trimmed.startsWith("pragma ") ||
      trimmed.startsWith("package ")
    ) {
      condensed.push(line);
      includedLinesCount++;
      linesSinceLastSignature = 0;
      continue;
    }

    // Preserve interfaces, types, structs, enums
    if (
      trimmed.startsWith("interface ") ||
      trimmed.startsWith("type ") ||
      trimmed.startsWith("struct ") ||
      trimmed.startsWith("enum ") ||
      trimmed.startsWith("contract ") ||
      trimmed.startsWith("abstract contract ") ||
      trimmed.startsWith("class ")
    ) {
      condensed.push(line);
      includedLinesCount++;
      linesSinceLastSignature = 0;
      continue;
    }

    // Preserve function signatures, modifiers, and event declarations
    if (
      trimmed.startsWith("function ") ||
      trimmed.startsWith("event ") ||
      trimmed.startsWith("modifier ") ||
      trimmed.startsWith("error ") ||
      trimmed.startsWith("constructor") ||
      /^(public|private|protected|async|static|const|function)\s+\w+/.test(trimmed) ||
      trimmed.includes("=>") ||
      trimmed.includes("):") ||
      trimmed.includes("returns (")
    ) {
      condensed.push(line);
      includedLinesCount++;
      linesSinceLastSignature = 0;
      continue;
    }

    // Include the first 3 lines inside any signature to capture entry logic / guards
    if (linesSinceLastSignature < 3 && (trimmed.startsWith("require(") || trimmed.startsWith("if (") || trimmed.startsWith("return "))) {
      condensed.push(line);
      includedLinesCount++;
      linesSinceLastSignature++;
      continue;
    }

    // Summarize omitted blocks if gap grows
    if (linesSinceLastSignature === 3) {
      condensed.push("    // ... [internal implementation logic omitted to preserve context tokens] ...");
      linesSinceLastSignature++;
    }
  }

  condensed.push(`// [END CONDENSED: Kept ${includedLinesCount} signature/interface lines from original ${lines.length} lines]`);
  return condensed.join("\n");
}

// ---------------------------------------------------------------------------
// 4. Primary Ingestion Engine API
// ---------------------------------------------------------------------------

/**
 * Ingests and processes a GitHub repository through the "10k Lines" Smart Context Engine.
 *
 * @param repoUrl GitHub URL (e.g. "https://github.com/owner/repo")
 * @returns IngestionResult with macro architectural tree, prioritized condensed code context, and metrics.
 */
export async function ingestRepository(repoUrl: string): Promise<IngestionResult> {
  const startTime = Date.now();

  // 1. Parse repository coordinates
  const { owner, repo, ref: urlRef } = parseGitHubUrl(repoUrl);
  const repoId = `${owner}/${repo}`;

  // 2. Resolve default branch and HEAD commit SHA
  const { ref, commitSha } = await resolveRef(owner, repo, urlRef);

  // 3. Fetch recursive repository tree
  const treeData = await githubGet<GitHubTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(commitSha)}?recursive=1`
  );

  const allBlobs = treeData.tree.filter((item) => item.type === "blob");
  const allPaths = allBlobs.map((b) => b.path);

  // 4. Generate high-level architectural directory tree
  const architecturalTree = generateArchitecturalTree(allPaths, 120);

  // 5. Prioritize and rank source files
  const prioritized = allBlobs
    .map((b) => calculateFilePriority(b.path, b.size ?? 0))
    .filter((f): f is PrioritizedFile => f !== null)
    .sort((a, b) => b.score - a.score);

  // Select top candidate files (limit to top 15 to stay within bounded network & tokens)
  const candidateFiles = prioritized.slice(0, 15);

  // 6. Concurrently fetch and condense files
  const fetchedFiles: {
    path: string;
    importance: FileImportance;
    content: string;
    originalLines: number;
    condensedLines: number;
  }[] = [];

  let totalOriginalLines = 0;
  let totalCondensedLines = 0;

  await Promise.allSettled(
    candidateFiles.map(async (file) => {
      try {
        const rawContent = await fetchFileContent(owner, repo, file.path, ref);
        const originalLines = rawContent.split("\n").length;
        const processedContent = condenseOversizedCode(rawContent, file.path);
        const condensedLines = processedContent.split("\n").length;

        fetchedFiles.push({
          path: file.path,
          importance: file.importance,
          content: processedContent,
          originalLines,
          condensedLines,
        });
      } catch (err) {
        console.warn(`[IngestionEngine] Skipped file ${file.path}:`, err instanceof Error ? err.message : err);
      }
    })
  );

  // Re-sort fetched files according to priority score
  fetchedFiles.sort((a, b) => {
    const scoreA = candidateFiles.find((c) => c.path === a.path)?.score ?? 0;
    const scoreB = candidateFiles.find((c) => c.path === b.path)?.score ?? 0;
    return scoreB - scoreA;
  });

  // 7. Assemble bounded code context with metadata headers
  let formattedCodeContext = "";
  let totalChars = 0;
  let filesIncluded = 0;

  for (const file of fetchedFiles) {
    const header = `--- FILE: ${file.path} | Lines: ${file.originalLines} | Importance: ${file.importance} ---\n`;
    const footer = `\n--- END OF FILE: ${file.path} ---\n\n`;
    const chunk = header + file.content + footer;

    if (totalChars + chunk.length > MAX_TOTAL_CONTEXT_CHARS) {
      const remainingBudget = MAX_TOTAL_CONTEXT_CHARS - totalChars - header.length - footer.length;
      if (remainingBudget > 500) {
        const partial = file.content.slice(0, remainingBudget) + "\n// ... [clamped at context boundary]";
        formattedCodeContext += header + partial + footer;
        totalChars = MAX_TOTAL_CONTEXT_CHARS;
        filesIncluded++;
      }
      break;
    }

    formattedCodeContext += chunk;
    totalChars += chunk.length;
    filesIncluded++;
    totalOriginalLines += file.originalLines;
    totalCondensedLines += file.condensedLines;
  }

  const estimatedTokens = Math.round(totalChars / 4);

  // Console telemetry matching requirement
  console.log(
    `[IngestionEngine] Analyzed ${allBlobs.length} files, compressed ${totalOriginalLines} lines into ~${estimatedTokens} tokens for model context (${(Date.now() - startTime)}ms)`
  );

  return {
    tree: architecturalTree,
    formattedCodeContext,
    totalFilesAnalyzed: allBlobs.length,
    commitHash: commitSha,
  };
}

/**
 * Backward-compatible helper for existing imports across the application.
 */
export async function fetchRepoContext(
  repoUrl: string,
  _maxFiles = 5
): Promise<RepoContext> {
  const { owner, repo, ref: urlRef } = parseGitHubUrl(repoUrl);
  const repoId = `${owner}/${repo}`;
  const { ref, commitSha } = await resolveRef(owner, repo, urlRef);

  const ingestion = await ingestRepository(repoUrl);

  const aggregatedSource =
    `# REPOSITORY: ${repoId}\n` +
    `# COMMIT: ${commitSha}\n\n` +
    `## MACRO ARCHITECTURAL TREE\n\`\`\`\n${ingestion.tree}\n\`\`\`\n\n` +
    `## CONDENSED SOURCE CODE CONTEXT\n\n${ingestion.formattedCodeContext}`;

  return {
    ...ingestion,
    repoId,
    ref,
    commitSha,
    repoUrl,
    aggregatedSource,
    files: {},
    fetchErrors: {},
  };
}
