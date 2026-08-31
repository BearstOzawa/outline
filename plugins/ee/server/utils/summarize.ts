import { TeamPreference } from "@shared/types";
import { DocumentValidation } from "@shared/validations";
import Logger from "@server/logging/Logger";
import { type Document, Team } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import env from "../env";

const MAX_SOURCE_CHARS = 8000;

const inflight = new Map<string, Promise<string | null>>();

export function summariesAvailable() {
  return !!env.AI_API_KEY;
}

export function cleanSummary(text: string) {
  return text
    .replace(/^```[\s\S]*?```$/g, "")
    .replace(/^["“]|["”]$/g, "")
    .replace(/^#+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DocumentValidation.maxSummaryLength);
}

export async function generateDocumentSummary(
  document: Document
): Promise<string | null> {
  if (!summariesAvailable()) {
    return document.summary || null;
  }

  const pending = inflight.get(document.id);
  if (pending) {
    return pending;
  }

  const run = (async () => {
    try {
      const team = document.team ?? (await Team.findByPk(document.teamId));
      if (!team?.getPreference(TeamPreference.AIAnswers)) {
        return document.summary || null;
      }

      const source = documentSummarySource(document);
      if (!source) {
        return document.summary || null;
      }

      const response = await fetch(`${env.AI_API_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.AI_MODEL,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: SUMMARY_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: source,
            },
          ],
        }),
      });

      if (!response.ok) {
        Logger.warn("document summary provider error", {
          documentId: document.id,
          status: response.status,
        });
        return document.summary || null;
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const summary = cleanSummary(
        payload.choices?.[0]?.message?.content ?? ""
      );
      if (!summary) {
        return document.summary || null;
      }

      await saveDocumentSummary(document, summary);
      return summary;
    } catch (error) {
      Logger.warn("document summary failed", {
        documentId: document.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return document.summary || null;
    }
  })();

  inflight.set(document.id, run);
  try {
    return await run;
  } finally {
    inflight.delete(document.id);
  }
}

export async function saveDocumentSummary(
  document: Document,
  summary: string
) {
  document.summary = summary;
  document.summaryGeneratedAt = new Date();
  await document.save({ silent: true });
}

export const SUMMARY_SYSTEM_PROMPT =
  "You write a short document summary for a knowledge base. Reply in the same language as the document. Use 1-3 sentences depending on how much content there is, no title, no markdown, no preamble. If the document is very short, restate its point in one sentence.";

export function documentSummarySource(document: Document) {
  const body = DocumentHelper.toPlainText(document)
    .replace(/\s+/g, " ")
    .trim();
  const title = (document.title || "").trim();
  if (!body && !title) {
    return null;
  }
  const excerpt = body.slice(0, MAX_SOURCE_CHARS);
  return title ? `Title: ${title}\n\n${excerpt}` : excerpt;
}
