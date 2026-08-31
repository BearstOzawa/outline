"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ai_conversations", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "",
      },
      messages: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      teamId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "teams",
        },
        onDelete: "CASCADE",
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
        },
        onDelete: "CASCADE",
      },
      documentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "documents",
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

    await queryInterface.addIndex("ai_conversations", ["userId", "updatedAt"]);
    await queryInterface.addIndex("ai_conversations", [
      "userId",
      "documentId",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ai_conversations");
  },
};
