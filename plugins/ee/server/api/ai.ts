import Router from "koa-router";
import { EmptyResultError, Op } from "sequelize";
import { TeamPreference } from "@shared/types";
import { ValidationError } from "@server/errors";
import Logger from "@server/logging/Logger";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import validate from "@server/middlewares/validate";
import documentLoader from "@server/commands/documentLoader";
import { Document, type User } from "@server/models";
import { authorize, can } from "@server/policies";
import type { APIContext } from "@server/types";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import SearchProviderManager from "@server/utils/SearchProviderManager";
import env from "../env";
import { scheduleEmbeddingBackfill } from "../tasks/BackfillDocumentEmbeddingsTask";
import {
  embeddingsAvailable,
  embeddingsConfigured,
  embedQuery,
} from "../utils/embeddings";
import { sourceUrlFor } from "../utils/locateExcerpt";
import {
  rerankAvailable,
  rerankConfigured,
  rerankPassages,
} from "../utils/rerank";
import { streamChatCompletion } from "../utils/chatStream";
import { beginSSE } from "../utils/sse";
import {
  cleanSummary,
  documentSummarySource,
  saveDocumentSummary,
  SUMMARY_SYSTEM_PROMPT,
} from "../utils/summarize";
import {
  embeddingIndexStatus,
  searchEmbeddings,
  teamHasEmbeddings,
  type EmbeddingHit,
} from "../utils/vectorStore";
import * as T from "./schema";

const router = new Router();

function claimAIRequest(ctx: APIContext) {
  const state = ctx.state as typeof ctx.state & { eeAIHandled?: boolean };
  if (state.eeAIHandled) {
    return false;
  }
  state.eeAIHandled = true;
  return true;
}

type Reference = {
  id: string;
  title: string;
  url: string;
  headingId?: string;
  snippet?: string;
  context?: string;
};

function excerpt(text: string, max = 1800) {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

async function documentsInTree(
  root: Document,
  teamId: string,
  limit = 12
): Promise<Document[]> {
  const collected: Document[] = [root];
  let frontier = [root.id];

  while (frontier.length && collected.length < limit) {
    const children = await Document.findAll({
      where: {
        teamId,
        parentDocumentId: { [Op.in]: frontier },
      },
    });
    if (children.length === 0) {
      break;
    }
    for (const child of children) {
      if (collected.length >= limit) {
        break;
      }
      collected.push(child);
    }
    frontier = children.map((child) => child.id);
  }

  return collected;
}

async function keywordHits(user: User, query: string, collectionId?: string) {
  const filter = collectionId
    ? {
        field: "collectionId" as const,
        operator: "eq" as const,
        value: collectionId,
      }
    : undefined;

  const search = await SearchProviderManager.getProvider().searchForUser(user, {
    query,
    filter,
    limit: 20,
    snippetMinWords: 80,
    snippetMaxWords: 240,
  });

  return {
    total: search.total,
    results: search.results.slice(0, 8),
  };
}

async function recentReadableDocuments(user: User, limit = 8) {
  const documents = await Document.withMembershipScope(user.id).findAll({
    where: {
      teamId: user.teamId,
      publishedAt: { [Op.ne]: null },
      archivedAt: { [Op.eq]: null },
    },
    order: [["updatedAt", "DESC"]],
    limit: 20,
  });
  return documents.filter((document) => can(user, "read", document)).slice(0, limit);
}

async function loadReadableDocuments(user: User, ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return [];
  }

  const documents = await Document.withMembershipScope(user.id).findAll({
    where: {
      id: uniqueIds,
      teamId: user.teamId,
    },
  });

  return documents.filter((document) => can(user, "read", document));
}

function pushExcerpt(
  references: Reference[],
  excerpts: string[],
  document: Document,
  text: string,
  context?: string
) {
  const body = excerpt(text);
  if (!body) {
    return;
  }
  const existing = references.find((item) => item.id === document.id);
  if (!existing) {
    const located = sourceUrlFor(document, text || context || "");
    references.push({
      id: document.id,
      title: document.titleWithDefault,
      url: located.url,
      headingId: located.headingId,
      snippet: located.snippet,
      context,
    });
  }
  excerpts.push(
    `[${references.findIndex((item) => item.id === document.id) + 1}] ${document.titleWithDefault}\n${body}`
  );
}

async function vectorContext(
  user: User,
  query: string,
  options: {
    collectionId?: string;
    documentIds?: string[];
    limit?: number;
  }
): Promise<{ hits: EmbeddingHit[]; usedVector: boolean }> {
  if (!embeddingsAvailable()) {
    return { hits: [], usedVector: false };
  }

  const queryEmbedding = await embedQuery(query);
  if (!queryEmbedding) {
    return { hits: [], usedVector: false };
  }

  const accessibleIds = await user.collectionIds();
  const collectionIds = options.collectionId
    ? accessibleIds.filter((id) => id === options.collectionId)
    : accessibleIds;

  const hits = await searchEmbeddings({
    teamId: user.teamId,
    collectionIds,
    documentIds: options.documentIds,
    queryEmbedding,
    limit: options.limit ?? 12,
  });

  return { hits, usedVector: hits.length > 0 };
}

async function maybeRerank(
  query: string,
  excerpts: string[],
  references: Reference[],
  enabled: boolean
) {
  if (!enabled || excerpts.length < 4) {
    return { excerpts, references };
  }

  const order = await rerankPassages(query, excerpts, 8);
  if (!order) {
    return { excerpts, references };
  }

  const nextExcerpts: string[] = [];
  const nextReferences: Reference[] = [];
  const seen = new Set<string>();
  for (const index of order) {
    const text = excerpts[index];
    if (!text) {
      continue;
    }
    nextExcerpts.push(text);
    const match = /^\[(\d+)\]/.exec(text);
    const reference = match ? references[Number(match[1]) - 1] : undefined;
    if (reference && !seen.has(reference.id)) {
      seen.add(reference.id);
      nextReferences.push(reference);
    }
  }

  return {
    excerpts: nextExcerpts.length ? nextExcerpts : excerpts,
    references: nextReferences.length ? nextReferences : references,
  };
}

export function registerDocumentAIRoutes(target: Router) {
  // Name-only, same as documents.list. Passing "/documents.answer" as a second
  // argument becomes "//documents.answer" after router.use("/", nested.routes())
  // and never matches POST /api/documents.answer.
  target.get("documents.answer", async (ctx) => {
    ctx.body = { data: { ok: true, endpoint: "documents.answer" } };
  });

  target.post(
    "documents.answer",
    auth(),
    rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
    validate(T.DocumentsAnswerSchema),
    async (ctx: APIContext<T.DocumentsAnswerReq>) => {
      if (!claimAIRequest(ctx)) {
        return;
      }

      try {
        await answerDocument(ctx);
      } catch (err) {
        if (
          err instanceof EmptyResultError ||
          (typeof err === "object" &&
            err !== null &&
            "status" in err &&
            (err as { status?: number }).status === 404)
        ) {
          throw ValidationError(
            err instanceof Error ? err.message : "Document not found"
          );
        }
        throw err;
      }
    }
  );

  async function answerDocument(ctx: APIContext<T.DocumentsAnswerReq>) {
      const { query, collectionId, documentId, history } = ctx.input.body;
      const { user } = ctx.state.auth;
      Logger.info("ai", "documents.answer", {
        documentId,
        userId: user.id,
      });

      authorize(user, "read", user.team);

      if (!user.team.getPreference(TeamPreference.AIAnswers)) {
        throw ValidationError("AI answers are disabled for this workspace");
      }

      if (!env.AI_API_KEY) {
        throw ValidationError(
          "AI answers are not configured. Set AI_API_KEY (or XAI_API_KEY) on the server."
        );
      }

      const references: Reference[] = [];
      const excerpts: string[] = [];
      const vectorEnabled =
        !!user.team.getPreference(TeamPreference.AIVectorSearch) &&
        embeddingsAvailable();
      const rerankEnabled =
        !!user.team.getPreference(TeamPreference.AIRerank) &&
        rerankAvailable();
      let indexed = false;
      try {
        indexed = vectorEnabled && (await teamHasEmbeddings(user.teamId));
      } catch {
        indexed = false;
      }

      if (!indexed && vectorEnabled) {
        await scheduleEmbeddingBackfill(user.teamId).catch(() => undefined);
      }

      if (documentId) {
        const root = await documentLoader({
          id: documentId,
          user,
        });
        const tree = await documentsInTree(root, user.teamId);
        const { hits } = indexed
          ? await vectorContext(user, query, {
              documentIds: tree.map((document) => document.id),
              limit: rerankEnabled ? 24 : 12,
            }).catch(() => ({ hits: [] as EmbeddingHit[], usedVector: false }))
          : { hits: [] };
        const documentsById = new Map(
          tree.map((document) => [document.id, document])
        );

        for (const hit of hits) {
          const document = documentsById.get(hit.documentId);
          if (!document) {
            continue;
          }
          pushExcerpt(references, excerpts, document, hit.content);
        }

        if (references.length === 0) {
          for (const document of tree) {
            pushExcerpt(references, excerpts, document, document.text || "");
          }
        }
      } else {
        const search = await keywordHits(user, query, collectionId);
        const keywordIds = search.results.map((result) => result.document.id);
        const { hits, usedVector } = indexed
          ? await vectorContext(user, query, {
              collectionId,
              limit: rerankEnabled ? 24 : 12,
            }).catch(() => ({ hits: [] as EmbeddingHit[], usedVector: false }))
          : { hits: [], usedVector: false };

        const vectorIds = hits.map((hit) => hit.documentId);
        const documents = await loadReadableDocuments(user, [
          ...vectorIds,
          ...keywordIds,
        ]);
        const documentsById = new Map(
          documents.map((document) => [document.id, document])
        );

        for (const hit of hits) {
          const document = documentsById.get(hit.documentId);
          if (!document) {
            continue;
          }
          pushExcerpt(references, excerpts, document, hit.content);
        }

        if (!usedVector || references.length < 3) {
          for (const result of search.results) {
            const document = documentsById.get(result.document.id);
            if (!document) {
              continue;
            }
            pushExcerpt(
              references,
              excerpts,
              document,
              document.text || result.context || "",
              result.context
            );
            if (excerpts.length >= 24) {
              break;
            }
          }
        }

        if (references.length === 0) {
          const recent = await recentReadableDocuments(user);
          for (const document of recent) {
            pushExcerpt(references, excerpts, document, document.text || "");
          }
        }
      }

      if (references.length === 0) {
        const sse = beginSSE(ctx);
        sse.send({ type: "done", answer: null, references: [] });
        sse.close();
        return;
      }

      const ranked = await maybeRerank(
        query,
        excerpts,
        references,
        rerankEnabled
      );
      const context = ranked.excerpts.slice(0, 8).join("\n\n");
      const cited = ranked.references;
      const prior = (history ?? []).slice(-8).map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }));

      const sse = beginSSE(ctx);
      sse.send({ type: "meta", references: cited });

      let answer = "";
      try {
        for await (const piece of streamChatCompletion({
          temperature: 0.2,
          signal: sse.signal,
          messages: [
            {
              role: "system",
              content: documentId
                ? "You answer questions using only the provided document and its child documents. Reply in the same language as the question. Reply in GitHub-flavored markdown: short paragraphs, headings, lists, and fenced code when useful. Lead with a direct answer, then supporting detail. Cite sources as [n] matching the numbered excerpts. If the documents do not contain the answer, say so clearly."
                : "You answer questions using only the provided workspace documents. Reply in the same language as the question. Reply in GitHub-flavored markdown: short paragraphs, headings, lists, and fenced code when useful. Lead with a direct answer, then supporting detail. Cite sources as [n] matching the numbered excerpts. If the documents do not contain the answer, say so clearly.",
            },
            ...prior,
            {
              role: "user",
              content: `Question: ${query}\n\nDocuments:\n${context}`,
            },
          ],
        })) {
          answer += piece;
          sse.send({ type: "delta", text: piece });
        }
        const final = answer.trim();
        sse.send({ type: "done", answer: final, references: cited });
      } catch (error) {
        if (!sse.signal.aborted) {
          sse.send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "AI provider request failed",
          });
        }
      } finally {
        sse.close();
      }
  }

  const COMPLETE_PROMPTS: Record<
    T.DocumentsCompleteReq["body"]["instruction"],
    string
  > = {
    improve:
      "Improve the writing quality of the text. Keep the same language and meaning. Return only the revised markdown, with no preamble.",
    shorter:
      "Rewrite the text to be more concise. Keep the same language and meaning. Return only the revised markdown, with no preamble.",
    longer:
      "Expand the text with useful detail. Keep the same language and meaning. Return only the revised markdown, with no preamble.",
    fix: "Fix spelling, grammar, and punctuation. Keep the same language. Return only the corrected markdown, with no preamble.",
    continue:
      "Continue writing from the end of the text in the same voice and language. Return only the continuation as markdown, with no preamble or quotation of the original.",
    summarize:
      "Summarize the text in the same language. Return only the summary as markdown, with no preamble.",
  };

  target.post(
    "documents.complete",
    auth(),
    rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
    validate(T.DocumentsCompleteSchema),
    async (ctx: APIContext<T.DocumentsCompleteReq>) => {
      if (!claimAIRequest(ctx)) {
        return;
      }
      const { instruction, text, documentId } = ctx.input.body;
      const { user } = ctx.state.auth;

      authorize(user, "read", user.team);

      if (!user.team.getPreference(TeamPreference.AIAnswers)) {
        throw ValidationError("AI answers are disabled for this workspace");
      }

      if (!env.AI_API_KEY) {
        throw ValidationError(
          "AI answers are not configured. Set AI_API_KEY (or XAI_API_KEY) on the server."
        );
      }

      let title = "";
      if (documentId) {
        const document = await documentLoader({
          id: documentId,
          user,
        });
        authorize(user, "update", document);
        title = document.titleWithDefault;
      }

      const sse = beginSSE(ctx);
      let completed = "";
      try {
        for await (const piece of streamChatCompletion({
          temperature: 0.4,
          signal: sse.signal,
          messages: [
            {
              role: "system",
              content: COMPLETE_PROMPTS[instruction],
            },
            {
              role: "user",
              content: title
                ? `Document title: ${title}\n\nText:\n${text}`
                : text,
            },
          ],
        })) {
          completed += piece;
          sse.send({ type: "delta", text: piece });
        }
        const textOut = completed.trim();
        if (!textOut) {
          sse.send({
            type: "error",
            message: "AI provider returned an empty response",
          });
        } else {
          sse.send({ type: "done", text: textOut });
        }
      } catch (error) {
        if (!sse.signal.aborted) {
          sse.send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "AI provider request failed",
          });
        }
      } finally {
        sse.close();
      }
    }
  );

  target.post(
    "documents.summary",
    auth(),
    rateLimiter(RateLimiterStrategy.TenPerMinute),
    validate(T.DocumentsSummarySchema),
    async (ctx: APIContext<T.DocumentsSummaryReq>) => {
      if (!claimAIRequest(ctx)) {
        return;
      }

      const { id } = ctx.input.body;
      const { user } = ctx.state.auth;
      authorize(user, "read", user.team);

      if (!user.team.getPreference(TeamPreference.AIAnswers)) {
        throw ValidationError("AI answers are disabled for this workspace");
      }

      const document = await documentLoader({
        id,
        user,
      });
      authorize(user, "update", document);

      const source = documentSummarySource(document);
      if (!source) {
        throw ValidationError("This document is too short to summarize");
      }

      const sse = beginSSE(ctx);
      let raw = "";
      try {
        for await (const piece of streamChatCompletion({
          temperature: 0.2,
          signal: sse.signal,
          messages: [
            { role: "system", content: SUMMARY_SYSTEM_PROMPT },
            { role: "user", content: source },
          ],
        })) {
          raw += piece;
          sse.send({ type: "delta", text: piece });
        }
        const summary = cleanSummary(raw);
        if (!summary) {
          sse.send({
            type: "error",
            message: "Could not generate a summary",
          });
        } else {
          await saveDocumentSummary(document, summary);
          sse.send({
            type: "done",
            summary,
            summaryGeneratedAt: document.summaryGeneratedAt,
          });
        }
      } catch (error) {
        if (!sse.signal.aborted) {
          sse.send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "AI provider request failed",
          });
        }
      } finally {
        sse.close();
      }
    }
  );
}

router.post(
  "ai.status",
  auth(),
  rateLimiter(RateLimiterStrategy.OneHundredPerMinute),
  validate(T.AIStatusSchema),
  async (ctx: APIContext<T.AIStatusReq>) => {
    const { user } = ctx.state.auth;
    authorize(user, "read", user.team);

    const embeddings = embeddingsConfigured();
    const index = embeddings
      ? await embeddingIndexStatus(user.teamId)
      : {
          eligibleDocuments: 0,
          indexedDocuments: 0,
          staleDocuments: 0,
          pendingDocuments: 0,
          lastIndexedAt: null as string | null,
        };

    ctx.body = {
      data: {
        embeddings: {
          configured: embeddings,
          available: embeddingsAvailable(),
          eligibleDocuments: index.eligibleDocuments,
          indexedDocuments: index.indexedDocuments,
          staleDocuments: index.staleDocuments,
          pendingDocuments: index.pendingDocuments,
          lastIndexedAt: index.lastIndexedAt,
        },
        rerank: {
          configured: rerankConfigured(),
          available: rerankAvailable(),
        },
      },
    };
  }
);

router.post(
  "ai.index",
  auth(),
  rateLimiter(RateLimiterStrategy.TenPerMinute),
  validate(T.AIIndexSchema),
  async (ctx: APIContext<T.AIIndexReq>) => {
    const { user } = ctx.state.auth;
    authorize(user, "update", user.team);

    if (!user.team.getPreference(TeamPreference.AIAnswers)) {
      throw ValidationError("AI answers are disabled for this workspace");
    }
    if (!user.team.getPreference(TeamPreference.AIVectorSearch)) {
      throw ValidationError("Vector search is disabled for this workspace");
    }
    if (!embeddingsConfigured()) {
      throw ValidationError("Embeddings are not configured on this server.");
    }
    if (!embeddingsAvailable()) {
      throw ValidationError("Embeddings are temporarily unavailable.");
    }

    await scheduleEmbeddingBackfill(user.teamId, {
      verify: ctx.input.body?.verify !== false,
    }).catch(() => undefined);

    const index = await embeddingIndexStatus(user.teamId);
    ctx.body = {
      data: {
        ...index,
        started: true,
      },
    };
  }
);

registerDocumentAIRoutes(router);

export default router;
