/**
 * agentJudgeAbi.ts
 *
 * Minimal ABI for AgentJudgeRegistry — only the functions and events
 * needed by the Next.js API route. Keeping it minimal reduces bundle size
 * and avoids importing the full Hardhat artifact at runtime.
 *
 * Source of truth: contracts/artifacts/contracts/AgentJudgeRegistry.sol/AgentJudgeRegistry.json
 * Solidity: ^0.8.24  |  Network: Avalanche Fuji (chainId 43113)
 */
export const AGENT_JUDGE_ABI = [
  // ── Write ──────────────────────────────────────────────────────────────────
  {
    inputs: [
      { internalType: "string",  name: "repoUrl",      type: "string"  },
      { internalType: "string",  name: "commitHash",   type: "string"  },
      { internalType: "uint8",   name: "codeScore",    type: "uint8"   },
      { internalType: "uint8",   name: "uiScore",      type: "uint8"   },
      { internalType: "string",  name: "feedbackHash", type: "string"  },
    ],
    name: "recordEvaluation",
    outputs: [{ internalType: "uint256", name: "evaluationId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ── Read ───────────────────────────────────────────────────────────────────
  {
    inputs: [{ internalType: "uint256", name: "evaluationId", type: "uint256" }],
    name: "getEvaluation",
    outputs: [
      {
        components: [
          { internalType: "string",  name: "repoUrl",      type: "string"  },
          { internalType: "string",  name: "commitHash",   type: "string"  },
          { internalType: "uint8",   name: "codeScore",    type: "uint8"   },
          { internalType: "uint8",   name: "uiScore",      type: "uint8"   },
          { internalType: "string",  name: "feedbackHash", type: "string"  },
          { internalType: "uint256", name: "timestamp",    type: "uint256" },
          { internalType: "address", name: "recordedBy",   type: "address" },
        ],
        internalType: "struct AgentJudgeRegistry.Evaluation",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalEvaluations",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "repoUrl", type: "string" }],
    name: "getEvaluationIdsByRepo",
    outputs: [{ internalType: "uint256[]", name: "ids", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "uint256", name: "evaluationId", type: "uint256" },
      { indexed: false, internalType: "string",  name: "repoUrl",      type: "string"  },
      { indexed: false, internalType: "string",  name: "commitHash",   type: "string"  },
      { indexed: false, internalType: "uint8",   name: "codeScore",    type: "uint8"   },
      { indexed: false, internalType: "uint8",   name: "uiScore",      type: "uint8"   },
      { indexed: false, internalType: "string",  name: "feedbackHash", type: "string"  },
      { indexed: false, internalType: "uint256", name: "timestamp",    type: "uint256" },
    ],
    name: "EvaluationRecorded",
    type: "event",
  },
] as const;
