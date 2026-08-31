import Router from "koa-router";
import { UserRole } from "@shared/types";
import { AuthorizationError, ValidationError } from "@server/errors";
import auth from "@server/middlewares/authentication";
import { transaction } from "@server/middlewares/transaction";
import validate from "@server/middlewares/validate";
import { Document } from "@server/models";
import { authorize } from "@server/policies";
import type { APIContext } from "@server/types";
import Attribute, { AttributeType } from "../models/Attribute";
import DocumentAttribute from "../models/DocumentAttribute";
import * as T from "./schema";

const router = new Router();

function presentAttribute(attribute: Attribute) {
  return {
    id: attribute.id,
    name: attribute.name,
    type: attribute.type,
    required: attribute.required,
    options: attribute.options,
    index: attribute.index,
    createdAt: attribute.createdAt,
    updatedAt: attribute.updatedAt,
  };
}

function presentDocumentAttribute(row: DocumentAttribute) {
  return {
    id: row.id,
    documentId: row.documentId,
    attributeId: row.attributeId,
    value: row.value,
    updatedAt: row.updatedAt,
  };
}

router.post(
  "attributes.list",
  auth(),
  validate(T.AttributesListSchema),
  async (ctx: APIContext<T.AttributesListReq>) => {
    const { user } = ctx.state.auth;
    authorize(user, "read", user.team);

    const attributes = await Attribute.findAll({
      where: { teamId: user.teamId },
      order: [
        ["index", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    ctx.body = {
      data: attributes.map(presentAttribute),
    };
  }
);

router.post(
  "attributes.create",
  auth({ role: UserRole.Admin }),
  validate(T.AttributesCreateSchema),
  transaction(),
  async (ctx: APIContext<T.AttributesCreateReq>) => {
    const { name, type, required, options } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    authorize(user, "update", user.team);

    if (type === AttributeType.List && (!options || options.length === 0)) {
      throw ValidationError("List attributes require at least one option");
    }

    const count = await Attribute.count({
      where: { teamId: user.teamId },
      transaction,
    });

    const attribute = await Attribute.create(
      {
        name,
        type,
        required: required ?? false,
        options: type === AttributeType.List ? options : null,
        index: count,
        teamId: user.teamId,
        createdById: user.id,
      },
      { transaction }
    );

    ctx.body = {
      data: presentAttribute(attribute),
    };
  }
);

router.post(
  "attributes.update",
  auth({ role: UserRole.Admin }),
  validate(T.AttributesUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.AttributesUpdateReq>) => {
    const { id, name, required, options, index } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    authorize(user, "update", user.team);

    const attribute = await Attribute.findByPk(id, {
      rejectOnEmpty: true,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (attribute.teamId !== user.teamId) {
      throw AuthorizationError();
    }

    if (name !== undefined) {
      attribute.name = name;
    }
    if (required !== undefined) {
      attribute.required = required;
    }
    if (options !== undefined && attribute.type === AttributeType.List) {
      attribute.options = options;
    }
    if (index !== undefined) {
      attribute.index = index;
    }

    await attribute.save({ transaction });

    ctx.body = {
      data: presentAttribute(attribute),
    };
  }
);

router.post(
  "attributes.delete",
  auth({ role: UserRole.Admin }),
  validate(T.AttributesDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.AttributesDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    authorize(user, "update", user.team);

    const attribute = await Attribute.findByPk(id, {
      rejectOnEmpty: true,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (attribute.teamId !== user.teamId) {
      throw AuthorizationError();
    }

    await DocumentAttribute.destroy({
      where: { attributeId: attribute.id },
      transaction,
    });
    await attribute.destroy({ transaction });

    ctx.body = {
      success: true,
    };
  }
);

router.post(
  "documentAttributes.list",
  auth(),
  validate(T.DocumentAttributesListSchema),
  async (ctx: APIContext<T.DocumentAttributesListReq>) => {
    const { documentId } = ctx.input.body;
    const { user } = ctx.state.auth;

    const document = await Document.findByPk(documentId, {
      userId: user.id,
      rejectOnEmpty: true,
    });
    authorize(user, "read", document);

    const [attributes, values] = await Promise.all([
      Attribute.findAll({
        where: { teamId: user.teamId },
        order: [
          ["index", "ASC"],
          ["createdAt", "ASC"],
        ],
      }),
      DocumentAttribute.findAll({
        where: { documentId },
      }),
    ]);

    ctx.body = {
      data: {
        attributes: attributes.map(presentAttribute),
        values: values.map(presentDocumentAttribute),
      },
    };
  }
);

router.post(
  "documentAttributes.update",
  auth(),
  validate(T.DocumentAttributesUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.DocumentAttributesUpdateReq>) => {
    const { documentId, values } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const document = await Document.findByPk(documentId, {
      userId: user.id,
      rejectOnEmpty: true,
      transaction,
    });
    authorize(user, "update", document);

    const attributes = await Attribute.findAll({
      where: { teamId: user.teamId },
      transaction,
    });
    const allowed = new Set(attributes.map((attribute) => attribute.id));

    for (const item of values) {
      if (!allowed.has(item.attributeId)) {
        continue;
      }

      const [row] = await DocumentAttribute.findOrCreate({
        where: {
          documentId,
          attributeId: item.attributeId,
        },
        defaults: {
          documentId,
          attributeId: item.attributeId,
          value: item.value,
        },
        transaction,
      });
      row.value = item.value;
      await row.save({ transaction });
    }

    const updated = await DocumentAttribute.findAll({
      where: { documentId },
      transaction,
    });

    ctx.body = {
      data: updated.map(presentDocumentAttribute),
    };
  }
);

export default router;
