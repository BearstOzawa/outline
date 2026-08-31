import { TeamPreference } from "@shared/types";
import BaseProcessor from "@server/queues/processors/BaseProcessor";
import type { Event, TeamEvent } from "@server/types";
import { scheduleEmbeddingBackfill } from "../tasks/BackfillDocumentEmbeddingsTask";
import IndexDocumentEmbeddingsTask from "../tasks/IndexDocumentEmbeddingsTask";
import { embeddingsAvailable } from "../utils/embeddings";
import {
  removeDocumentEmbeddings,
  updateEmbeddingCollection,
} from "../utils/vectorStore";

export default class DocumentEmbeddingProcessor extends BaseProcessor {
  static applicableEvents: Event["name"][] = [
    "documents.publish",
    "documents.update.delayed",
    "documents.unarchive",
    "documents.restore",
    "documents.delete",
    "documents.permanent_delete",
    "documents.unpublish",
    "documents.archive",
    "documents.move",
    "teams.update",
  ];

  static shouldQueue = async () => embeddingsAvailable();

  public async perform(event: Event) {
    if (event.name === "teams.update") {
      const enabled =
        (event as TeamEvent).changes?.attributes.preferences?.[
          TeamPreference.AIVectorSearch
        ] === true;
      if (enabled) {
        await scheduleEmbeddingBackfill(event.teamId).catch(() => undefined);
      }
      return;
    }

    if (!("documentId" in event) || !event.documentId) {
      return;
    }

    if (
      event.name === "documents.delete" ||
      event.name === "documents.permanent_delete" ||
      event.name === "documents.unpublish" ||
      event.name === "documents.archive"
    ) {
      await removeDocumentEmbeddings(event.documentId);
      return;
    }

    if (event.name === "documents.move") {
      await updateEmbeddingCollection(
        event.data.documentIds,
        event.collectionId
      );
      return;
    }

    await new IndexDocumentEmbeddingsTask()
      .schedule(
        {
          documentId: event.documentId,
          teamId: event.teamId,
        },
        { jobId: `embed-doc-${event.documentId}` }
      )
      .catch(() => undefined);
  }
}
