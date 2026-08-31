import Router from "koa-router";
import { Op } from "sequelize";
import { TeamPreference } from "@shared/types";
import documentLoader from "@server/commands/documentLoader";
import { NotFoundError, ValidationError } from "@server/errors";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import validate from "@server/middlewares/validate";
import { authorize } from "@server/policies";
import type { APIContext } from "@server/types";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import AIConversation from "../models/AIConversation";
import * as T from "./schema";

const router = new Router();

function presentConversation(conversation: AIConversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    documentId: conversation.documentId,
    messages: conversation.messages ?? [],
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

function assertAIEnabled(user: APIContext["state"]["auth"]["user"]) {
  authorize(user, "read", user.team);
  if (!user.team.getPreference(TeamPreference.AIAnswers)) {
    throw ValidationError("AI answers are disabled for this workspace");
  }
}

async function assertDocumentAccess(
  user: APIContext["state"]["auth"]["user"],
  documentId?: string | null
) {
  if (!documentId) {
    return;
  }
  await documentLoader({
    id: documentId,
    user,
  });
}

router.post(
  "aiConversations.list",
  auth(),
  rateLimiter(RateLimiterStrategy.OneHundredPerMinute),
  validate(T.AIConversationsListSchema),
  async (ctx: APIContext<T.AIConversationsListReq>) => {
    const { user } = ctx.state.auth;
    assertAIEnabled(user);
    const documentId = ctx.input.body?.documentId ?? null;
    await assertDocumentAccess(user, documentId);

    const conversations = await AIConversation.findAll({
      where: {
        teamId: user.teamId,
        userId: user.id,
        documentId: documentId ? documentId : { [Op.is]: null },
      },
      order: [["updatedAt", "DESC"]],
      limit: 50,
    });

    ctx.body = {
      data: conversations.map(presentConversation),
    };
  }
);

router.post(
  "aiConversations.create",
  auth(),
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  validate(T.AIConversationsCreateSchema),
  async (ctx: APIContext<T.AIConversationsCreateReq>) => {
    const { user } = ctx.state.auth;
    assertAIEnabled(user);
    const { documentId, title, messages } = ctx.input.body;
    await assertDocumentAccess(user, documentId);

    const conversation = await AIConversation.create({
      teamId: user.teamId,
      userId: user.id,
      documentId: documentId ?? null,
      title: title?.trim() || "",
      messages: messages ?? [],
    });

    ctx.body = {
      data: presentConversation(conversation),
    };
  }
);

router.post(
  "aiConversations.update",
  auth(),
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  validate(T.AIConversationsUpdateSchema),
  async (ctx: APIContext<T.AIConversationsUpdateReq>) => {
    const { user } = ctx.state.auth;
    assertAIEnabled(user);
    const { id, title, messages } = ctx.input.body;

    const conversation = await AIConversation.findOne({
      where: {
        id,
        teamId: user.teamId,
        userId: user.id,
      },
    });
    if (!conversation) {
      throw NotFoundError();
    }

    if (title !== undefined) {
      conversation.title = title.trim();
    }
    if (messages !== undefined) {
      conversation.messages = messages;
    }
    await conversation.save();

    ctx.body = {
      data: presentConversation(conversation),
    };
  }
);

router.post(
  "aiConversations.delete",
  auth(),
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  validate(T.AIConversationsDeleteSchema),
  async (ctx: APIContext<T.AIConversationsDeleteReq>) => {
    const { user } = ctx.state.auth;
    assertAIEnabled(user);
    const { id } = ctx.input.body;

    const conversation = await AIConversation.findOne({
      where: {
        id,
        teamId: user.teamId,
        userId: user.id,
      },
    });
    if (!conversation) {
      throw NotFoundError();
    }

    await conversation.destroy();

    ctx.body = {
      success: true,
    };
  }
);

export default router;
