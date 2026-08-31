import { TeamPreference } from "@shared/types";
import { Document, Team } from "@server/models";
import { BaseTask, TaskPriority } from "@server/queues/tasks/base/BaseTask";
import { embeddingsAvailable } from "../utils/embeddings";
import { indexDocument } from "../utils/vectorStore";

type Props = {
  documentId: string;
  teamId: string;
};

export default class IndexDocumentEmbeddingsTask extends BaseTask<Props> {
  public async perform({ documentId, teamId }: Props) {
    if (!embeddingsAvailable()) {
      return;
    }

    const team = await Team.findByPk(teamId);
    if (
      !team?.getPreference(TeamPreference.AIAnswers) ||
      !team.getPreference(TeamPreference.AIVectorSearch)
    ) {
      return;
    }

    const document = await Document.findByPk(documentId, {
      paranoid: false,
    });
    if (!document) {
      return;
    }

    await indexDocument(document);
  }

  public get options() {
    return {
      attempts: 3,
      priority: TaskPriority.Background,
      backoff: {
        type: "exponential" as const,
        delay: 60 * 1000,
      },
    };
  }
}
