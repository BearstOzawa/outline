import { Document } from "@server/models";
import { BaseTask, TaskPriority } from "@server/queues/tasks/base/BaseTask";
import {
  generateDocumentSummary,
  summariesAvailable,
} from "../utils/summarize";

type Props = {
  documentId: string;
};

export default class GenerateDocumentSummaryTask extends BaseTask<Props> {
  public async perform({ documentId }: Props) {
    if (!summariesAvailable()) {
      return;
    }

    const document = await Document.findByPk(documentId);
    if (!document || document.template) {
      return;
    }

    await generateDocumentSummary(document);
  }

  public get options() {
    return {
      attempts: 2,
      priority: TaskPriority.Background,
      backoff: {
        type: "exponential" as const,
        delay: 30 * 1000,
      },
    };
  }
}
