import { describe, expect, it } from "vitest";
import { decryptText, encryptText } from "./encryptedBlock";

describe("encryptedBlock", () => {
  it("round-trips plaintext with a password", async () => {
    const payload = await encryptText("secret note", "hunter2");
    expect(payload.ciphertext).toBeTruthy();
    expect(payload.ciphertext).not.toContain("secret note");
    await expect(decryptText(payload, "hunter2")).resolves.toBe("secret note");
  });

  it("rejects the wrong password", async () => {
    const payload = await encryptText("secret note", "hunter2");
    await expect(decryptText(payload, "wrong")).rejects.toThrow();
  });
});
