import markdownit from "markdown-it";
import { describe, expect, it } from "vitest";
import encryptedRule from "./encrypted";

describe("encryptedRule", () => {
  it("parses a placeholder comment as an encrypted token", () => {
    const md = markdownit("default", { html: false }).use(encryptedRule);
    const tokens = md.parse("<!-- encrypted-block -->\n", {});
    expect(tokens.some((token) => token.type === "encrypted")).toBe(true);
  });

  it("does not treat other comments as encrypted", () => {
    const md = markdownit("default", { html: false }).use(encryptedRule);
    const tokens = md.parse("<!-- not encrypted -->\n", {});
    expect(tokens.some((token) => token.type === "encrypted")).toBe(false);
  });
});
