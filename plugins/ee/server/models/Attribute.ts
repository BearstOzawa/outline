import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Table,
} from "sequelize-typescript";
import { Team, User } from "@server/models";
import IdModel from "@server/models/base/IdModel";
import Length from "@server/models/validators/Length";
import DocumentAttribute from "./DocumentAttribute";

export enum AttributeType {
  Boolean = "boolean",
  Number = "number",
  Text = "text",
  List = "list",
}

@Table({ tableName: "attributes", modelName: "attribute" })
class Attribute extends IdModel<
  InferAttributes<Attribute>,
  Partial<InferCreationAttributes<Attribute>>
> {
  @Length({
    max: 100,
    msg: "name must be 100 characters or less",
  })
  @Column(DataType.STRING)
  name: string;

  @Default(AttributeType.Text)
  @Column(DataType.STRING)
  type: AttributeType;

  @Default(false)
  @Column(DataType.BOOLEAN)
  required: boolean;

  /** Options for list-type attributes. */
  @Column(DataType.JSONB)
  options: string[] | null;

  @Column(DataType.INTEGER)
  index: number | null;

  @BelongsTo(() => Team, "teamId")
  team: Team;

  @ForeignKey(() => Team)
  @Column(DataType.UUID)
  teamId: string;

  @BelongsTo(() => User, "createdById")
  createdBy: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  createdById: string;

  @HasMany(() => DocumentAttribute, "attributeId")
  values: DocumentAttribute[];
}

export default Attribute;
