import { describe, expect, it } from "vitest";
import { chunkText, cosineSimilarity } from "./embeddings";

describe("chunkText", () => {
  it("returns a single chunk for short documents", () => {
    expect(chunkText("Title", "Hello world")).toEqual(["Title\n\nHello world"]);
  });

  it("returns nothing for empty documents", () => {
    expect(chunkText("", "")).toEqual([]);
  });

  it("splits long text into overlapping pieces", () => {
    const body = Array.from(
      { length: 40 },
      (_, i) => `Paragraph ${i} ${"x".repeat(80)}`
    ).join("\n\n");
    const chunks = chunkText("Guide", body, 200, 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].startsWith("Guide")).toBe(true);
    expect(chunks.every((chunk) => chunk.length <= 200)).toBe(true);
  });
});

describe("cosineSimilarity", () => {
  it("ranks an identical vector highest", () => {
    const query = [1, 0, 0];
    const same = cosineSimilarity(query, [1, 0, 0]);
    const close = cosineSimilarity(query, [0.8, 0.2, 0]);
    const far = cosineSimilarity(query, [0, 1, 0]);
    expect(same).toBeGreaterThan(close);
    expect(close).toBeGreaterThan(far);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [1])).toBe(0);
  });
});
