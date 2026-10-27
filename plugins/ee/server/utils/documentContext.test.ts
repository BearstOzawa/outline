import { Document } from "@server/models";
import {
  buildAdmin,
  buildDocument,
  buildPersonalCollection,
  buildUser,
} from "@server/test/factories";
import { documentContextText, readableDocumentTree } from "./documentContext";

describe("AI document context", () => {
  it("reads the current content when the legacy text column is omitted", async () => {
    const owner = await buildUser();
    const collection = await buildPersonalCollection(owner);
    const document = await buildDocument({
      teamId: owner.teamId,
      userId: owner.id,
      collectionId: collection.id,
      text: "Current document content",
    });
    const loaded = await Document.withMembershipScope(owner.id).findByPk(
      document.id,
      {
        rejectOnEmpty: true,
      }
    );
    expect(documentContextText(loaded)).toContain("Current document content");
  });

  it("includes readable personal descendants but rejects another user's personal tree", async () => {
    const owner = await buildUser();
    const collection = await buildPersonalCollection(owner);
    const root = await buildDocument({
      teamId: owner.teamId,
      userId: owner.id,
      collectionId: collection.id,
    });
    const child = await buildDocument({
      teamId: owner.teamId,
      userId: owner.id,
      collectionId: collection.id,
      parentDocumentId: root.id,
    });
    const loaded = await Document.findByPk(root.id, {
      userId: owner.id,
      rejectOnEmpty: true,
    });
    const tree = await readableDocumentTree(loaded, owner);
    expect(tree.map((doc) => doc.id)).toEqual([root.id, child.id]);

    const admin = await buildAdmin({ teamId: owner.teamId });
    const otherView = await Document.findByPk(root.id, {
      userId: admin.id,
      rejectOnEmpty: true,
    });
    await expect(readableDocumentTree(otherView, admin)).rejects.toThrow();
  });
});
