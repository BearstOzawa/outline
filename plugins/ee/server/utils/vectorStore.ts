import { randomUUID } from "node:crypto";
import type { WhereOptions } from "sequelize";
import { Op, QueryTypes } from "sequelize";
import Logger from "@server/logging/Logger";
import type { Document } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import { sequelize } from "@server/storage/database";
import env from "../env";
import DocumentEmbedding from "../models/DocumentEmbedding";
import {
  chunkText,
  contentHash,
  cosineSimilarity,
  embeddingsAvailable,
  embedTexts,
} from "./embeddings";

export type EmbeddingHit = {
  documentId: string;
  collectionId: string | null;
  content: string;
  score: number;
};

const JS_SCAN_LIMIT = 8000;

let pgvectorCached: boolean | null = null;

export async function hasPgVector(): Promise<boolean> {
  if (pgvectorCached !== null) {
    return pgvectorCached;
  }

  try {
    const rows = await sequelize.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS exists`,
      { type: QueryTypes.SELECT }
    );
    pgvectorCached = !!rows[0]?.exists;
  } catch (error) {
    Logger.warn("Failed to detect pgvector extension", {
      error: error instanceof Error ? error.message : String(error),
    });
    pgvectorCached = false;
  }

  return pgvectorCached;
}

function documentBody(document: Document) {
  try {
    if (document.content) {
      return DocumentHelper.toPlainText(document);
    }
  } catch {
    // Fall through to the markdown column.
  }
  return document.text || "";
}

export async function removeDocumentEmbeddings(documentId: string) {
  await DocumentEmbedding.destroy({ where: { documentId } });
}

export async function updateEmbeddingCollection(
  documentIds: string[],
  collectionId: string
) {
  if (documentIds.length === 0) {
    return;
  }
  await DocumentEmbedding.update(
    { collectionId },
    { where: { documentId: documentIds } }
  );
}

export async function indexDocument(document: Document) {
  if (!embeddingsAvailable()) {
    return;
  }

  if (
    document.isDraft ||
    document.template ||
    document.archivedAt ||
    document.deletedAt ||
    !document.publishedAt
  ) {
    await removeDocumentEmbeddings(document.id);
    return;
  }

  const title = document.titleWithDefault;
  const body = documentBody(document);
  const hash = contentHash(env.AI_EMBEDDING_MODEL ?? "", title, body);
  const existing = await DocumentEmbedding.findOne({
    where: { documentId: document.id },
    attributes: ["contentHash"],
  });
  if (existing?.contentHash === hash) {
    return;
  }

  const chunks = chunkText(title, body);
  if (chunks.length === 0) {
    await removeDocumentEmbeddings(document.id);
    return;
  }

  const vectors = await embedTexts(chunks);
  if (!vectors) {
    return;
  }

  const now = new Date();
  const rows = chunks.map((content, chunkIndex) => ({
    id: randomUUID(),
    content,
    embedding: vectors[chunkIndex],
    model: env.AI_EMBEDDING_MODEL,
    contentHash: hash,
    chunkIndex,
    teamId: document.teamId,
    documentId: document.id,
    collectionId: document.collectionId,
    createdAt: now,
    updatedAt: now,
  }));

  await sequelize.transaction(async (transaction) => {
    await DocumentEmbedding.destroy({
      where: { documentId: document.id },
      transaction,
    });
    await DocumentEmbedding.bulkCreate(rows, { transaction });
  });
}

function toVectorLiteral(values: number[]) {
  if (!values.every((value) => Number.isFinite(value))) {
    throw new Error("invalid embedding vector");
  }
  return `[${values.join(",")}]`;
}

async function searchWithPgVector(options: {
  teamId: string;
  collectionIds: string[];
  documentIds?: string[];
  queryEmbedding: number[];
  limit: number;
}): Promise<EmbeddingHit[] | null> {
  const { teamId, collectionIds, documentIds, queryEmbedding, limit } = options;
  if (collectionIds.length === 0 && !documentIds?.length) {
    return [];
  }

  const filters = [`"teamId" = :teamId`];
  const replacements: Record<string, unknown> = {
    teamId,
    queryVector: toVectorLiteral(queryEmbedding),
    limit,
  };

  if (documentIds?.length) {
    filters.push(`"documentId" IN (:documentIds)`);
    replacements.documentIds = documentIds;
  } else {
    filters.push(`"collectionId" IN (:collectionIds)`);
    replacements.collectionIds = collectionIds;
  }

  try {
    return await sequelize.query<EmbeddingHit>(
      `
        SELECT
          "documentId",
          "collectionId",
          content,
          1 - (embedding::text::vector <=> CAST(:queryVector AS vector)) AS score
        FROM document_embeddings
        WHERE ${filters.join(" AND ")}
        ORDER BY embedding::text::vector <=> CAST(:queryVector AS vector)
        LIMIT :limit
      `,
      {
        type: QueryTypes.SELECT,
        replacements,
      }
    );
  } catch (error) {
    Logger.warn("pgvector search failed, falling back to in-process cosine", {
      error: error instanceof Error ? error.message : String(error),
    });
    pgvectorCached = false;
    return null;
  }
}

async function searchWithCosine(options: {
  teamId: string;
  collectionIds: string[];
  documentIds?: string[];
  queryEmbedding: number[];
  limit: number;
}): Promise<EmbeddingHit[]> {
  const { teamId, collectionIds, documentIds, queryEmbedding, limit } = options;
  const where: WhereOptions<DocumentEmbedding> = { teamId };

  if (documentIds?.length) {
    where.documentId = documentIds;
  } else if (collectionIds.length > 0) {
    where.collectionId = { [Op.in]: collectionIds };
  } else {
    return [];
  }

  const rows = await DocumentEmbedding.findAll({
    where,
    attributes: ["documentId", "collectionId", "content", "embedding"],
    limit: JS_SCAN_LIMIT,
    order: [["updatedAt", "DESC"]],
  });

  return rows
    .map((row) => ({
      documentId: row.documentId,
      collectionId: row.collectionId,
      content: row.content,
      score: cosineSimilarity(queryEmbedding, row.embedding || []),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function searchEmbeddings(options: {
  teamId: string;
  collectionIds: string[];
  documentIds?: string[];
  queryEmbedding: number[];
  limit?: number;
}): Promise<EmbeddingHit[]> {
  const limit = options.limit ?? 12;
  if (await hasPgVector()) {
    const hits = await searchWithPgVector({ ...options, limit });
    if (hits) {
      return hits;
    }
  }
  return searchWithCosine({ ...options, limit });
}

const ELIGIBLE_DOCUMENTS = `
  documents."teamId" = :teamId
  AND documents."publishedAt" IS NOT NULL
  AND documents."archivedAt" IS NULL
  AND documents."deletedAt" IS NULL
  AND documents.template = false
`;

function asCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

export async function teamHasEmbeddings(teamId: string) {
  const count = await DocumentEmbedding.count({
    where: { teamId },
  });
  return count > 0;
}

export async function cleanupOrphanEmbeddings(teamId: string) {
  await sequelize.query(
    `
      DELETE FROM document_embeddings
      WHERE "teamId" = :teamId
        AND "documentId" NOT IN (
          SELECT documents.id
          FROM documents
          WHERE ${ELIGIBLE_DOCUMENTS}
        )
    `,
    { replacements: { teamId } }
  );
}

export async function embeddingIndexStatus(teamId: string) {
  const model = env.AI_EMBEDDING_MODEL ?? "";
  const replacements = { teamId, model };

  const [eligible] = await sequelize.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM documents WHERE ${ELIGIBLE_DOCUMENTS}`,
    { type: QueryTypes.SELECT, replacements }
  );
  const [indexed] = await sequelize.query<{ count: number }>(
    `
      SELECT COUNT(DISTINCT document_embeddings."documentId") AS count
      FROM document_embeddings
      INNER JOIN documents ON documents.id = document_embeddings."documentId"
      WHERE ${ELIGIBLE_DOCUMENTS}
        AND document_embeddings."teamId" = :teamId
    `,
    { type: QueryTypes.SELECT, replacements }
  );
  const [stale] = await sequelize.query<{ count: number }>(
    `
      SELECT COUNT(DISTINCT document_embeddings."documentId") AS count
      FROM document_embeddings
      INNER JOIN documents ON documents.id = document_embeddings."documentId"
      WHERE ${ELIGIBLE_DOCUMENTS}
        AND document_embeddings."teamId" = :teamId
        AND document_embeddings.model IS DISTINCT FROM :model
    `,
    { type: QueryTypes.SELECT, replacements }
  );
  const latest = await DocumentEmbedding.max("updatedAt", {
    where: { teamId },
  });

  const eligibleDocuments = asCount(eligible?.count);
  const indexedDocuments = asCount(indexed?.count);
  const staleDocuments = asCount(stale?.count);
  const missingDocuments = Math.max(eligibleDocuments - indexedDocuments, 0);

  return {
    eligibleDocuments,
    indexedDocuments,
    staleDocuments,
    pendingDocuments: missingDocuments + staleDocuments,
    lastIndexedAt: latest
      ? new Date(latest as string | Date).toISOString()
      : null,
  };
}

export async function nextDocumentsToEmbed(options: {
  teamId: string;
  verify?: boolean;
  cursorUpdatedAt?: string;
  cursorId?: string;
  limit?: number;
}) {
  const limit = options.limit ?? 25;
  const model = env.AI_EMBEDDING_MODEL ?? "";
  const replacements: Record<string, unknown> = {
    teamId: options.teamId,
    model,
    limit,
  };

  let cursorSql = "";
  if (options.cursorUpdatedAt && options.cursorId) {
    replacements.cursorUpdatedAt = options.cursorUpdatedAt;
    replacements.cursorId = options.cursorId;
    cursorSql = `
      AND (
        documents."updatedAt" < :cursorUpdatedAt
        OR (
          documents."updatedAt" = :cursorUpdatedAt
          AND documents.id < :cursorId
        )
      )
    `;
  }

  const needSql = options.verify
    ? ""
    : `
      AND (
        NOT EXISTS (
          SELECT 1
          FROM document_embeddings
          WHERE document_embeddings."documentId" = documents.id
        )
        OR EXISTS (
          SELECT 1
          FROM document_embeddings
          WHERE document_embeddings."documentId" = documents.id
            AND document_embeddings.model IS DISTINCT FROM :model
        )
      )
    `;

  return sequelize.query<{ id: string; updatedAt: Date }>(
    `
      SELECT documents.id, documents."updatedAt"
      FROM documents
      WHERE ${ELIGIBLE_DOCUMENTS}
        ${needSql}
        ${cursorSql}
      ORDER BY documents."updatedAt" DESC, documents.id DESC
      LIMIT :limit
    `,
    { type: QueryTypes.SELECT, replacements }
  );
}
