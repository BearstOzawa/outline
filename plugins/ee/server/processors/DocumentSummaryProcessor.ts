import BaseProcessor from "@server/queues/processors/BaseProcessor";
import type { Event } from "@server/types";
import GenerateDocumentSummaryTask from "../tasks/GenerateDocumentSummaryTask";
import { summariesAvailable } from "../utils/summarize";

export default class DocumentSummaryProcessor extends BaseProcessor {
  static applicableEvents: Event["name"][] = [
    "documents.publish",
    "documents.update.delayed",
    "documents.unarchive",
    "documents.restore",
  ];

  static shouldQueue = async () => summariesAvailable();

  public async perform(event: Event) {
    if (!("documentId" in event) || !event.documentId) {
      return;
    }

    await new GenerateDocumentSummaryTask()
      .schedule(
        { documentId: event.documentId },
        { jobId: `summary-doc-${event.documentId}` }
      )
      .catch(() => undefined);
  }
}
