import { z } from "zod";
import { BaseSchema } from "@server/routes/api/schema";
import { AttributeType } from "../models/Attribute";

export const AttributesListSchema = BaseSchema.extend({
  body: z.object({}).optional(),
});

export type AttributesListReq = z.infer<typeof AttributesListSchema>;

export const AttributesCreateSchema = BaseSchema.extend({
  body: z.object({
    name: z.string().min(1).max(100),
    type: z.enum(AttributeType),
    required: z.boolean().optional(),
    options: z.array(z.string().min(1).max(100)).nullish(),
  }),
});

export type AttributesCreateReq = z.infer<typeof AttributesCreateSchema>;

export const AttributesUpdateSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    name: z.string().min(1).max(100).optional(),
    required: z.boolean().optional(),
    options: z.array(z.string().min(1).max(100)).nullish(),
    index: z.number().int().optional(),
  }),
});

export type AttributesUpdateReq = z.infer<typeof AttributesUpdateSchema>;

export const AttributesDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type AttributesDeleteReq = z.infer<typeof AttributesDeleteSchema>;

export const DocumentAttributesListSchema = BaseSchema.extend({
  body: z.object({
    documentId: z.uuid(),
  }),
});

export type DocumentAttributesListReq = z.infer<
  typeof DocumentAttributesListSchema
>;

export const DocumentAttributesUpdateSchema = BaseSchema.extend({
  body: z.object({
    documentId: z.uuid(),
    values: z.array(
      z.object({
        attributeId: z.uuid(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      })
    ),
  }),
});

export type DocumentAttributesUpdateReq = z.infer<
  typeof DocumentAttributesUpdateSchema
>;

export const DocumentsAnswerSchema = BaseSchema.extend({
  body: z.object({
    query: z.string().min(1).max(2000),
    collectionId: z.uuid().optional(),
    documentId: z.string().min(1).max(255).optional(),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(8000),
        })
      )
      .max(12)
      .optional(),
  }),
});

export type DocumentsAnswerReq = z.infer<typeof DocumentsAnswerSchema>;

export const DocumentsCompleteSchema = BaseSchema.extend({
  body: z.object({
    instruction: z.enum([
      "improve",
      "shorter",
      "longer",
      "fix",
      "continue",
      "summarize",
    ]),
    text: z.string().min(1).max(20000),
    documentId: z.uuid().optional(),
  }),
});

export type DocumentsCompleteReq = z.infer<typeof DocumentsCompleteSchema>;

export const DocumentsSummarySchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type DocumentsSummaryReq = z.infer<typeof DocumentsSummarySchema>;

export const AIStatusSchema = BaseSchema.extend({
  body: z.object({}).optional(),
});

export type AIStatusReq = z.infer<typeof AIStatusSchema>;

export const AIIndexSchema = BaseSchema.extend({
  body: z
    .object({
      verify: z.boolean().optional(),
    })
    .optional(),
});

export type AIIndexReq = z.infer<typeof AIIndexSchema>;

export const ConfluenceImportSchema = BaseSchema.extend({
  body: z.object({
    attachmentId: z.uuid(),
    permission: z.string().optional(),
  }),
});

export type ConfluenceImportReq = z.infer<typeof ConfluenceImportSchema>;

const AIConversationMessageSchema = z.object({
  id: z.string().min(1).max(80),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(0).max(20000),
  references: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        title: z.string().max(500),
        url: z.string().max(2000),
        headingId: z.string().max(200).optional(),
        snippet: z.string().max(120).optional(),
      })
    )
    .max(50)
    .optional(),
  error: z.boolean().optional(),
});

export const AIConversationsListSchema = BaseSchema.extend({
  body: z
    .object({
      documentId: z.uuid().nullable().optional(),
    })
    .optional(),
});

export type AIConversationsListReq = z.infer<typeof AIConversationsListSchema>;

export const AIConversationsCreateSchema = BaseSchema.extend({
  body: z.object({
    documentId: z.uuid().nullable().optional(),
    title: z.string().max(200).optional(),
    messages: z.array(AIConversationMessageSchema).max(200).optional(),
  }),
});

export type AIConversationsCreateReq = z.infer<
  typeof AIConversationsCreateSchema
>;

export const AIConversationsUpdateSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    title: z.string().max(200).optional(),
    messages: z.array(AIConversationMessageSchema).max(200).optional(),
  }),
});

export type AIConversationsUpdateReq = z.infer<
  typeof AIConversationsUpdateSchema
>;

export const AIConversationsDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type AIConversationsDeleteReq = z.infer<
  typeof AIConversationsDeleteSchema
>;
