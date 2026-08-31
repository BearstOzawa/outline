import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Table,
} from "sequelize-typescript";
import { Document } from "@server/models";
import IdModel from "@server/models/base/IdModel";
import Attribute from "./Attribute";

@Table({
  tableName: "document_attributes",
  modelName: "documentAttribute",
  indexes: [
    {
      fields: ["documentId", "attributeId"],
      unique: true,
    },
  ],
})
class DocumentAttribute extends IdModel<
  InferAttributes<DocumentAttribute>,
  Partial<InferCreationAttributes<DocumentAttribute>>
> {
  @Column(DataType.JSONB)
  value: string | number | boolean | null;

  @BelongsTo(() => Document, "documentId")
  document: Document;

  @ForeignKey(() => Document)
  @Column(DataType.UUID)
  documentId: string;

  @BelongsTo(() => Attribute, "attributeId")
  attribute: Attribute;

  @ForeignKey(() => Attribute)
  @Column(DataType.UUID)
  attributeId: string;
}

export default DocumentAttribute;
