/**
 * contractClient.ts
 *
 * Server-side Ethers.js v6 client for AgentJudgeRegistry.
 *
 * Provides:
 *  - A singleton JsonRpcProvider connected to Avalanche Fuji
 *  - A singleton Wallet (the owner/deployer key)
 *  - A factory that returns a typed Contract instance ready for signing
 *
 * All secrets are read lazily from environment variables so this module
 * is safe to import at the top of any server-only API route.
 *
 * IMPORTANT: This module must NEVER be imported from client components.
 * Add "server-only" guard if you later enable React Server Components.
 */

import { ethers } from "ethers";
import { AGENT_JUDGE_ABI } from "@/lib/agentJudgeAbi";

// ---------------------------------------------------------------------------
// Singletons — initialised once per Node.js process
// ---------------------------------------------------------------------------

let _provider: ethers.JsonRpcProvider | null = null;
let _wallet: ethers.Wallet | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (_provider) return _provider;

  const rpcUrl =
    process.env.FUJI_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    process.env.RPC_URL ||
    "https://api.avax-test.network/ext/bc/C/rpc";

  _provider = new ethers.JsonRpcProvider(rpcUrl, {
    name: "avalanche-fuji",
    chainId: 43113,
  });

  return _provider;
}

function getWallet(): ethers.Wallet {
  if (_wallet) return _wallet;

  const rawKey =
    process.env.DEPLOYER_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.WALLET_PRIVATE_KEY;

  if (!rawKey) {
    throw new Error(
      "[Praetor] Deployer private key is not set. Add DEPLOYER_PRIVATE_KEY, PRIVATE_KEY, or WALLET_PRIVATE_KEY to .env.local."
    );
  }

  // Normalise: ensure the key has a 0x prefix
  const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

  _wallet = new ethers.Wallet(privateKey, getProvider());
  return _wallet;
}

/**
 * Returns a connected, signer-backed Contract instance for AgentJudgeRegistry.
 * The returned instance can call all write functions (e.g. recordEvaluation).
 */
export function getRegistryContract(): ethers.Contract {
  const address =
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    "0x8dF146E5B190DB9B3a397E9456B2002A4EE38439";

  if (!address || address === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "[Praetor] NEXT_PUBLIC_CONTRACT_ADDRESS is not set or is the zero address. " +
      "Deploy the contract first and update agent-judge/.env.local."
    );
  }

  return new ethers.Contract(address, AGENT_JUDGE_ABI, getWallet());
}

/**
 * Returns a read-only Contract instance backed by the JSON-RPC provider.
 * Safe for view calls without requiring private key signing permissions.
 */
export function getReadOnlyRegistryContract(): ethers.Contract {
  const address =
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    "0x8dF146E5B190DB9B3a397E9456B2002A4EE38439";

  if (!address || address === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "[Praetor] NEXT_PUBLIC_CONTRACT_ADDRESS is not set or is the zero address."
    );
  }

  return new ethers.Contract(address, AGENT_JUDGE_ABI, getProvider());
}

/**
 * Fetches all on-chain evaluations from AgentJudgeRegistry using strictly 0-indexed iteration:
 * from 0 to totalCount - 1.
 */
export async function getOnChainEvaluations(): Promise<{
  id: number;
  evaluation: any;
}[]> {
  const contract = getReadOnlyRegistryContract();
  const totalCount = Number(await contract.totalEvaluations());
  const evaluations = [];

  for (let i = 0; i < totalCount; i++) {
    const evaluation = await contract.getEvaluation(i);
    evaluations.push({ id: i, evaluation });
  }

  return evaluations;
}

/**
 * Convenience: returns just the provider (for read-only calls).
 */
export { getProvider, getWallet };


