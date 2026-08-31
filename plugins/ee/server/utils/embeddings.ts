import { createHash } from "node:crypto";
import Logger from "@server/logging/Logger";
import env from "../env";

export const CHUNK_MAX_CHARS = 1800;
export const CHUNK_OVERLAP = 200;
export const MAX_CHUNKS_PER_DOCUMENT = 48;
export const EMBED_BATCH_SIZE = 16;

const DISABLE_MS = 30 * 60 * 1000;

let embeddingsDisabledUntil = 0;

function splitOversized(part: string, maxChars: number, overlap: number) {
  const pieces: string[] = [];
  let start = 0;
  while (start < part.length) {
    const end = Math.min(start + maxChars, part.length);
    pieces.push(part.slice(start, end));
    if (end >= part.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }
  return pieces;
}

/**
 * Split a document into overlapping passages for embedding.
 */
export function chunkText(
  title: string,
  body: string,
  maxChars = CHUNK_MAX_CHARS,
  overlap = CHUNK_OVERLAP
): string[] {
  const heading = title.trim();
  const text = (body || "").replace(/\r\n/g, "\n").trim();
  if (!heading && !text) {
    return [];
  }

  const prefixed = heading ? `${heading}\n\n${text}`.trim() : text;
  if (prefixed.length <= maxChars) {
    return [prefixed];
  }

  const parts = prefixed.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
    }
    current = "";
  };

  for (const part of parts) {
    if (!part.trim()) {
      continue;
    }
    const candidate = current ? `${current}\n\n${part}` : part;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    pushCurrent();
    if (part.length <= maxChars) {
      current = part;
      continue;
    }
    for (const piece of splitOversized(part, maxChars, overlap)) {
      chunks.push(piece);
    }
  }
  pushCurrent();

  return chunks.slice(0, MAX_CHUNKS_PER_DOCUMENT);
}

export function contentHash(model: string, title: string, body: string) {
  return createHash("sha256")
    .update(model)
    .update("\0")
    .update(String(CHUNK_MAX_CHARS))
    .update("\0")
    .update(title)
    .update("\0")
    .update(body)
    .digest("hex");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) {
    return 0;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function embeddingsConfigured() {
  return (
    !!env.embeddingApiKey &&
    !!env.embeddingApiBaseUrl &&
    !!env.AI_EMBEDDING_MODEL
  );
}

export function embeddingsAvailable() {
  return embeddingsConfigured() && Date.now() >= embeddingsDisabledUntil;
}

function disableEmbeddings(reason: string) {
  embeddingsDisabledUntil = Date.now() + DISABLE_MS;
  Logger.warn("Document embeddings disabled temporarily", { reason });
}

type EmbeddingResponse = {
  data?: { embedding?: number[] }[];
};

async function embedBatch(inputs: string[]): Promise<number[][] | null> {
  if (!embeddingsAvailable()) {
    return null;
  }

  const response = await fetch(`${env.embeddingApiBaseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.embeddingApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.AI_EMBEDDING_MODEL,
      input: inputs,
    }),
  });

  if (response.status === 404 || response.status === 400) {
    const detail = await response.text();
    disableEmbeddings(
      `provider returned ${response.status} for ${env.AI_EMBEDDING_MODEL}: ${detail.slice(0, 180)}`
    );
    return null;
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Embedding provider returned ${response.status}: ${detail.slice(0, 200)}`
    );
  }

  const payload = (await response.json()) as EmbeddingResponse;
  const vectors = (payload.data ?? [])
    .map((row) => row.embedding)
    .filter((row): row is number[] => Array.isArray(row) && row.length > 0);

  if (vectors.length !== inputs.length) {
    throw new Error(
      `Embedding provider returned ${vectors.length} vectors for ${inputs.length} inputs`
    );
  }

  return vectors;
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!embeddingsAvailable() || texts.length === 0) {
    return null;
  }

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await embedBatch(batch);
    if (!vectors) {
      return null;
    }
    out.push(...vectors);
  }
  return out;
}

export async function embedQuery(query: string): Promise<number[] | null> {
  const vectors = await embedTexts([query]);
  return vectors?.[0] ?? null;
}
