import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Table,
} from "sequelize-typescript";
import { Collection, Document, Team } from "@server/models";
import IdModel from "@server/models/base/IdModel";

@Table({
  tableName: "document_embeddings",
  modelName: "documentEmbedding",
  indexes: [
    {
      fields: ["documentId", "chunkIndex"],
      unique: true,
    },
  ],
})
class DocumentEmbedding extends IdModel<
  InferAttributes<DocumentEmbedding>,
  Partial<InferCreationAttributes<DocumentEmbedding>>
> {
  @Column(DataType.TEXT)
  content: string;

  @Column(DataType.JSONB)
  embedding: number[];

  @Column(DataType.STRING)
  model: string;

  @Column(DataType.STRING)
  contentHash: string;

  @Column(DataType.INTEGER)
  chunkIndex: number;

  @BelongsTo(() => Team, "teamId")
  team: Team;

  @ForeignKey(() => Team)
  @Column(DataType.UUID)
  teamId: string;

  @BelongsTo(() => Document, "documentId")
  document: Document;

  @ForeignKey(() => Document)
  @Column(DataType.UUID)
  documentId: string;

  @BelongsTo(() => Collection, "collectionId")
  collection: Collection | null;

  @ForeignKey(() => Collection)
  @Column(DataType.UUID)
  collectionId: string | null;
}

export default DocumentEmbedding;
