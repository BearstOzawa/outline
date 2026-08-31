"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("attributes", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      options: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      index: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      teamId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "teams",
        },
      },
      createdById: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
        },
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("attributes", ["teamId"]);

    await queryInterface.createTable("document_attributes", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      value: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      documentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "documents",
        },
        onDelete: "CASCADE",
      },
      attributeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "attributes",
        },
        onDelete: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("document_attributes", ["documentId"]);
    await queryInterface.addIndex(
      "document_attributes",
      ["documentId", "attributeId"],
      { unique: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("document_attributes");
    await queryInterface.dropTable("attributes");
  },
};
