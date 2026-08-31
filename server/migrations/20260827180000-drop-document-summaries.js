"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP TABLE IF EXISTS "document_summaries" CASCADE;'
    );
  },

  async down() {
    // History table is not restored.
  },
};
