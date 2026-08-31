import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Table,
} from "sequelize-typescript";
import { Document, Team, User } from "@server/models";
import IdModel from "@server/models/base/IdModel";

export type AIConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  references?: {
    id: string;
    title: string;
    url: string;
    headingId?: string;
    snippet?: string;
  }[];
  error?: boolean;
};

@Table({
  tableName: "ai_conversations",
  modelName: "aiConversation",
  indexes: [
    {
      fields: ["userId", "updatedAt"],
    },
    {
      fields: ["userId", "documentId"],
    },
  ],
})
class AIConversation extends IdModel<
  InferAttributes<AIConversation>,
  Partial<InferCreationAttributes<AIConversation>>
> {
  @Default("")
  @Column(DataType.STRING)
  title: string;

  @Column(DataType.JSONB)
  messages: AIConversationMessage[];

  @BelongsTo(() => Team, "teamId")
  team: Team;

  @ForeignKey(() => Team)
  @Column(DataType.UUID)
  teamId: string;

  @BelongsTo(() => User, "userId")
  user: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  userId: string;

  @BelongsTo(() => Document, "documentId")
  document: Document | null;

  @AllowNull
  @ForeignKey(() => Document)
  @Column(DataType.UUID)
  documentId: string | null;
}

export default AIConversation;
