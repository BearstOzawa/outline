import path from "node:path";
import Router from "koa-router";
import { CollectionPermission, UserRole } from "@shared/types";
import { ValidationError } from "@server/errors";
import documentCreator from "@server/commands/documentCreator";
import { DocumentConverter } from "@server/converters/DocumentConverter";
import auth from "@server/middlewares/authentication";
import { transaction } from "@server/middlewares/transaction";
import validate from "@server/middlewares/validate";
import { Attachment, Collection } from "@server/models";
import { authorize } from "@server/policies";
import { presentCollection, presentPolicies } from "@server/presenters";
import FileStorage from "@server/storage/files";
import type { APIContext } from "@server/types";
import ZipHelper from "@server/utils/ZipHelper";
import * as T from "./schema";

const router = new Router();

const SKIP_HTML = /^(index|page-information|search-results|space-tools)\.html$/i;

router.post(
  "confluence.import",
  auth({ role: UserRole.Member }),
  validate(T.ConfluenceImportSchema),
  transaction(),
  async (ctx: APIContext<T.ConfluenceImportReq>) => {
    const { attachmentId, permission } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    authorize(user, "createCollection", user.team);

    const attachment = await Attachment.findByPk(attachmentId, {
      rejectOnEmpty: true,
      transaction,
    });

    if (attachment.teamId !== user.teamId) {
      throw ValidationError("Attachment not found");
    }

    const handle = await FileStorage.getFileHandle(attachment.key);
    const markdownByPath = new Map<string, { title: string; text: string }>();

    let tree;
    try {
      tree = await ZipHelper.toFileTree(
        handle.path,
        async (node, entry) => {
          const ext = path.extname(node.name).toLowerCase();
          if (ext !== ".html" && ext !== ".htm") {
            return;
          }
          if (SKIP_HTML.test(node.name)) {
            return;
          }

          const buffer = await entry.readBuffer(5 * 1024 * 1024);
          const converted = await DocumentConverter.convert(
            buffer,
            node.name,
            "text/html"
          );
          markdownByPath.set(node.pathInZip, {
            title: converted.title || node.title,
            text: converted.text,
          });
        }
      );
    } finally {
      await handle.cleanup();
    }

    if (markdownByPath.size === 0) {
      throw ValidationError(
        "Could not find HTML pages in the Confluence export zip"
      );
    }

    const collectionName =
      tree.children.find((node) => node.children.length > 0)?.title ||
      path.basename(attachment.name, path.extname(attachment.name)) ||
      "Confluence import";

    const collection = Collection.build({
      name: collectionName.slice(0, 100),
      teamId: user.teamId,
      createdById: user.id,
      permission:
        (permission as CollectionPermission | undefined) ??
        CollectionPermission.ReadWrite,
    });
    await collection.saveWithCtx(ctx);

    for (const page of markdownByPath.values()) {
      await documentCreator(ctx, {
        title: page.title.slice(0, 100),
        text: page.text,
        collectionId: collection.id,
        publish: true,
      });
    }

    const reloaded = await Collection.findByPk(collection.id, {
      userId: user.id,
      transaction,
      rejectOnEmpty: true,
    });

    ctx.body = {
      data: await presentCollection(ctx, reloaded),
      policies: presentPolicies(user, [reloaded]),
    };
  }
);

export default router;
