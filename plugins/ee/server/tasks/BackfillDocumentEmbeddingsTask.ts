import { TeamPreference } from "@shared/types";
import { Team } from "@server/models";
import { BaseTask, TaskPriority } from "@server/queues/tasks/base/BaseTask";
import { embeddingsAvailable } from "../utils/embeddings";
import {
  cleanupOrphanEmbeddings,
  nextDocumentsToEmbed,
} from "../utils/vectorStore";
import IndexDocumentEmbeddingsTask from "./IndexDocumentEmbeddingsTask";

type Props = {
  teamId: string;
  /** Walk every published document and hash-skip unchanged ones. */
  verify?: boolean;
  cursorUpdatedAt?: string;
  cursorId?: string;
};

const BATCH = 25;

export async function scheduleEmbeddingBackfill(
  teamId: string,
  options: Omit<Props, "teamId"> = {}
) {
  const isStart = !options.cursorUpdatedAt && !options.cursorId;
  return new BackfillDocumentEmbeddingsTask().schedule(
    { teamId, ...options },
    isStart
      ? { jobId: `backfill-embeddings-${teamId}` }
      : { delay: 2000 }
  );
}

export default class BackfillDocumentEmbeddingsTask extends BaseTask<Props> {
  public async perform({
    teamId,
    verify,
    cursorUpdatedAt,
    cursorId,
  }: Props) {
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

    if (!cursorUpdatedAt && !cursorId) {
      await cleanupOrphanEmbeddings(teamId);
    }

    const documents = await nextDocumentsToEmbed({
      teamId,
      verify,
      cursorUpdatedAt,
      cursorId,
      limit: BATCH,
    });

    for (const document of documents) {
      await new IndexDocumentEmbeddingsTask()
        .schedule(
          {
            documentId: document.id,
            teamId,
          },
          { jobId: `embed-doc-${document.id}` }
        )
        .catch(() => undefined);
    }

    if (documents.length === BATCH) {
      const last = documents[documents.length - 1];
      await scheduleEmbeddingBackfill(teamId, {
        verify,
        cursorUpdatedAt: new Date(last.updatedAt).toISOString(),
        cursorId: last.id,
      }).catch(() => undefined);
    }
  }

  public get options() {
    return {
      attempts: 1,
      priority: TaskPriority.Background,
    };
  }
}
