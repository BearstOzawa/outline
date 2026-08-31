"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("document_embeddings", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      embedding: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      model: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      contentHash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      chunkIndex: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      teamId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "teams",
        },
        onDelete: "CASCADE",
      },
      documentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "documents",
        },
        onDelete: "CASCADE",
      },
      collectionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "collections",
        },
        onDelete: "SET NULL",
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

    await queryInterface.addIndex("document_embeddings", ["teamId"]);
    await queryInterface.addIndex("document_embeddings", ["documentId"]);
    await queryInterface.addIndex("document_embeddings", [
      "teamId",
      "collectionId",
    ]);
    await queryInterface.addIndex(
      "document_embeddings",
      ["documentId", "chunkIndex"],
      { unique: true }
    );

    // Optional: enable pgvector so retrieval can use native cosine distance.
    // Official postgres images often lack the extension; JSONB remains the store.
    try {
      await queryInterface.sequelize.query(
        "CREATE EXTENSION IF NOT EXISTS vector"
      );
    } catch {
      // Extension not available on this Postgres; in-app cosine is used instead.
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("document_embeddings");
  },
};
