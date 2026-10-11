import fs from "fs";
import path from "path";

export interface EvaluationItem {
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
  snowtraceUrl?: string;
  onChainEvaluationId?: string;
  onChainError?: string;
  filesAnalyzed: number;
  videoName?: string;
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "evaluations.json");

const SEED_EVALUATIONS: EvaluationItem[] = [
  {
    id: "eval-avax-subnets",
    repoUrl: "https://github.com/ava-labs/subnet-evm",
    repoId: "ava-labs/subnet-evm",
    commitSha: "a49f120e7b8",
    ref: "master",
    codeScore: 96,
    uiScore: 92,
    totalScore: 95,
    isFrontendConnected: true,
    feedback: "Exceptional architecture with custom stateful precompiles, comprehensive consensus validation tests, and elegant Go module boundaries. The demo walkthrough confirms end-to-end integration with Avalanche C-Chain RPC endpoints.",
    goodPractices: "Clean separation of precompile state machines with strict byte-level gas accounting. Thorough test coverage across consensus edge cases and memory pools.",
    badPractices: "Minor redundancy in mock genesis generation scripts. Several legacy configuration flags remain without deprecation warnings.",
    deductionReasons: "Deducted 4 points on code for legacy config structs, and 8 points on UI for lack of transaction receipt animation in the explorer view.",
    architecturalSummary: "Avalanche custom Subnet EVM layer integrating with the AvalancheGo Snow consensus engine via gRPC state sync.",
    feedbackHash: "0x8fa40bc714f31c82e6bb5c81de402377b25ad75c2e9b01f9c5d120fa26eb98c3",
    txHash: "0x3b892a0149e6f477382c7a950e12d458bc26e1074a4cf965768ba2f601a74289",
    snowtraceUrl: "https://testnet.snowtrace.io/tx/0x3b892a0149e6f477382c7a950e12d458bc26e1074a4cf965768ba2f601a74289",
    onChainEvaluationId: "1",
    filesAnalyzed: 18,
    videoName: "subnet-evm-demo.mp4",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "eval-agent-judge",
    repoUrl: "https://github.com/hacktober/agent-judge",
    repoId: "hacktober/agent-judge",
    commitSha: "6ae9735a947",
    ref: "main",
    codeScore: 95,
    uiScore: 94,
    totalScore: 95,
    isFrontendConnected: true,
    feedback: "High-grade TypeScript implementation featuring clean separation of concerns between GitHub REST ingestion, Gemma 4 multimodal prompting, and Ethers.js v6 on-chain settlement. The UI exhibits responsive dark cosmic styling with verified contract links.",
    goodPractices: "Robust 4-tier AST context condensation pipeline preventing token overflow. Immutable cryptographic settlement via Ethers.js on Avalanche Fuji.",
    badPractices: "Temporary in-memory evaluation cache should migrate to PostgreSQL or decentralized storage for production scale. Limited unit test suite for video polling timeouts.",
    deductionReasons: "Deducted 5 points for missing end-to-end integration test mocks and 6 points on UI for mobile landscape view edge padding.",
    architecturalSummary: "Next.js App Router client communicating with a serverless evaluation harness that invokes Google Gen AI Files API and writes to AgentJudgeRegistry on Fuji.",
    feedbackHash: "0x51c72f10b2e84128a1ce77926e82845c48b29841f3d6ea9242981bc89a647209",
    txHash: "0x78ab123490fd38271e847c2937e28946f01928475a837c928475019283746501",
    snowtraceUrl: "https://testnet.snowtrace.io/tx/0x78ab123490fd38271e847c2937e28946f01928475a837c928475019283746501",
    onChainEvaluationId: "2",
    filesAnalyzed: 12,
    videoName: "agentjudge-walkthrough.mp4",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "eval-solidity-core",
    repoUrl: "https://github.com/ethereum/solidity",
    repoId: "ethereum/solidity",
    commitSha: "3f721abb091",
    ref: "develop",
    codeScore: 93,
    uiScore: 84,
    totalScore: 90,
    isFrontendConnected: true,
    feedback: "Industry-defining compiler codebase with exhaustive AST parsing, formal verification rules, and modular EVM target backends. The accompanying demonstration proves accurate code generation and CLI diagnostic flags.",
    goodPractices: "Formal verification pipeline with SMT checker integration. Rigorous defensive assertions across EVM opcode generation.",
    badPractices: "Extremely complex C++ template metaprogramming introduces high compilation overhead. Documentation for internal IR optimizer passes is sparse.",
    deductionReasons: "Deducted 7 points for legacy Yul optimizer passes and 16 points for CLI-only visual interface lacking a graphical debugger.",
    architecturalSummary: "Lexer/Parser pipeline generating AST, translated into Yul Intermediate Representation, optimized, and emitted as EVM bytecode.",
    feedbackHash: "0x32e9104fa2847d1948529cb91028374659102847561928475619283746501928",
    txHash: "0x9182374650192837465019283746501928374650192837465019283746501928",
    snowtraceUrl: "https://testnet.snowtrace.io/tx/0x9182374650192837465019283746501928374650192837465019283746501928",
    onChainEvaluationId: "3",
    filesAnalyzed: 24,
    videoName: "solc-compiler-tests.webm",
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: "eval-hyper-liquid",
    repoUrl: "https://github.com/hyperliquid-dex/hyper-evm",
    repoId: "hyperliquid-dex/hyper-evm",
    commitSha: "90ca7b10294",
    ref: "main",
    codeScore: 88,
    uiScore: 91,
    totalScore: 89,
    isFrontendConnected: true,
    feedback: "High-throughput order matching engine with custom memory-mapped ring buffers. UI demo highlights millisecond telemetry updates and wallet signature validation across testnet routes.",
    goodPractices: "Lock-free circular queues for order book sequencing. Efficient signature batching on order placement.",
    badPractices: "Hardcoded WebSocket reconnect intervals without exponential backoff. Insufficient telemetry logging on matching engine dropouts.",
    deductionReasons: "Deducted 12 points on code for unhandled WS disconnects, and 9 points on UI for missing dark mode chart crosshair alignment.",
    architecturalSummary: "Rust matching engine streaming real-time order states to Next.js frontend via binary WebSockets with on-chain settlement.",
    feedbackHash: "0x2894750192837465019283746501928374650192837465019283746501928374",
    txHash: "0x4019283746501928374650192837465019283746501928374650192837465019",
    snowtraceUrl: "https://testnet.snowtrace.io/tx/0x4019283746501928374650192837465019283746501928374650192837465019",
    onChainEvaluationId: "4",
    filesAnalyzed: 14,
    videoName: "hyper-evm-preview.mp4",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

const inMemoryStore = new Map<string, EvaluationItem>();

// Seed in-memory store
for (const seed of SEED_EVALUATIONS) {
  inMemoryStore.set(seed.id, seed);
}

function ensureStorage(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Re-seed or update if needed
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(SEED_EVALUATIONS, null, 2), "utf-8");
    }
  } catch (err) {
    // Safe guard against EROFS on Vercel serverless runtime
    console.warn("[evaluationsStore] Serverless filesystem initialization note:", err);
  }
}

export function getAllEvaluations(): EvaluationItem[] {
  ensureStorage();
  const diskItems: EvaluationItem[] = [];
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        diskItems.push(...parsed);
      }
    }
  } catch {
    // Ephemeral or read-only filesystem fallback
  }

  const combined = Array.from(inMemoryStore.values()).concat(diskItems);
  const seen = new Set<string>();
  const unique: EvaluationItem[] = [];
  for (const item of combined) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique.sort((a, b) => b.totalScore - a.totalScore);
}

export function getEvaluationById(id: string): EvaluationItem | null {
  // Check in-memory store first
  if (inMemoryStore.has(id)) {
    return inMemoryStore.get(id)!;
  }
  for (const item of inMemoryStore.values()) {
    if (item.onChainEvaluationId === id) return item;
  }

  const all = getAllEvaluations();
  return all.find((item) => item.id === id || item.onChainEvaluationId === id) || null;
}

export function saveEvaluation(item: EvaluationItem): void {
  // Always update in-memory store first for serverless lifetime
  inMemoryStore.set(item.id, item);

  ensureStorage();
  try {
    const all = getAllEvaluations();
    const index = all.findIndex((i) => i.id === item.id);
    if (index >= 0) {
      all[index] = item;
    } else {
      all.unshift(item);
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), "utf-8");
  } catch (err) {
    // Safe guard: catch EROFS: read-only file system without crashing on Vercel
    console.warn("[evaluationsStore] Handled serverless filesystem write restriction:", err);
  }
}
