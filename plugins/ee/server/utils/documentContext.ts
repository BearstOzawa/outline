import { Op } from "sequelize";
import { Document, type User } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import { authorize, can } from "@server/policies";

/** Returns current document content even when list queries omit legacy text. */
export function documentContextText(document: Document): string {
  return DocumentHelper.toPlainText(document);
}

/** Collects a document tree, checking the reader's access to every descendant. */
export async function readableDocumentTree(
  root: Document,
  user: User,
  limit = 12
): Promise<Document[]> {
  authorize(user, "read", root);
  const collected = [root];
  const visited = new Set([root.id]);
  let frontier = [root.id];

  while (frontier.length && collected.length < limit) {
    const children = await Document.withMembershipScope(user.id).findAll({
      where: {
        teamId: user.teamId,
        parentDocumentId: { [Op.in]: frontier },
      },
      order: [["id", "ASC"]],
    });
    frontier = [];
    for (const child of children) {
      if (visited.has(child.id) || !can(user, "read", child)) {
        continue;
      }
      visited.add(child.id);
      collected.push(child);
      frontier.push(child.id);
      if (collected.length >= limit) {
        break;
      }
    }
  }
  return collected;
}
