import Logger from "@server/logging/Logger";
import env from "../env";

const DISABLE_MS = 30 * 60 * 1000;
let rerankDisabledUntil = 0;

export function rerankConfigured() {
  return !!env.rerankApiKey && !!env.rerankApiBaseUrl && !!env.AI_RERANK_MODEL;
}

export function rerankAvailable() {
  return rerankConfigured() && Date.now() >= rerankDisabledUntil;
}

function disableRerank(reason: string) {
  rerankDisabledUntil = Date.now() + DISABLE_MS;
  Logger.warn("Document rerank disabled temporarily", { reason });
}

type RerankResponse = {
  results?: { index?: number; relevance_score?: number; score?: number }[];
  data?: { index?: number; relevance_score?: number; score?: number }[];
};

/**
 * Reorder passages with an optional rerank API (Jina / Cohere / OpenAI-compatible).
 * Returns a permutation of indices, or null to keep the original order.
 */
export async function rerankPassages(
  query: string,
  passages: string[],
  topN = 8
): Promise<number[] | null> {
  if (!rerankAvailable() || passages.length < 2) {
    return null;
  }

  const response = await fetch(`${env.rerankApiBaseUrl}/rerank`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.rerankApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.AI_RERANK_MODEL,
      query,
      documents: passages,
      top_n: Math.min(topN, passages.length),
    }),
  });

  if (response.status === 404 || response.status === 400) {
    const detail = await response.text();
    disableRerank(
      `provider returned ${response.status} for ${env.AI_RERANK_MODEL}: ${detail.slice(0, 180)}`
    );
    return null;
  }

  if (!response.ok) {
    Logger.warn("Rerank provider request failed", {
      status: response.status,
    });
    return null;
  }

  const payload = (await response.json()) as RerankResponse;
  const rows = payload.results ?? payload.data ?? [];
  const indices = rows
    .map((row) => row.index)
    .filter((index): index is number => Number.isInteger(index));

  if (indices.length === 0) {
    return null;
  }

  return [...new Set(indices)];
}
