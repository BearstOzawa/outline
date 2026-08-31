import { describe, expect, it } from "vitest";
import textBetween from "../lib/textBetween";
import { parser, schema, serializer } from "../../test/editor";

describe("Encrypted node", () => {
  it("keeps ciphertext out of plain text and markdown", () => {
    const node = schema.nodes.encrypted.create({
      ciphertext: "SECRET-CIPHERTEXT",
      iv: "iv",
      salt: "salt",
      iterations: 210000,
      label: "Payroll",
    });
    const doc = schema.nodes.doc.create(null, node);
    const plain = textBetween(doc, 0, doc.content.size);
    expect(plain).not.toContain("SECRET-CIPHERTEXT");
    expect(plain).not.toContain("Payroll");

    const markdown = serializer.serialize(doc);
    expect(markdown).not.toContain("SECRET-CIPHERTEXT");
    expect(markdown).toContain("<!-- encrypted-block -->");
  });

  it("parses the markdown placeholder as an encrypted node without payload", () => {
    const doc = parser.parse("<!-- encrypted-block -->\n");
    let found = false;
    doc.descendants((child) => {
      if (child.type.name === "encrypted") {
        found = true;
        expect(child.attrs.ciphertext).toBe("");
      }
    });
    expect(found).toBe(true);
  });
});
