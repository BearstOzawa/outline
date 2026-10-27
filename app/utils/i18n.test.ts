import i18n from "i18next";
import de_DE from "../../shared/i18n/locales/de_DE/translation.json";
import en_US from "../../shared/i18n/locales/en_US/translation.json";
import zh_CN from "../../shared/i18n/locales/zh_CN/translation.json";
import pt_PT from "../../shared/i18n/locales/pt_PT/translation.json";

// i18n is already initialized globally via app/test/setup.ts — only add
// test resources here, without re-initializing the singleton.
beforeAll(() => {
  i18n
    .addResources("en-US", "translation", en_US)
    .addResources("de-DE", "translation", de_DE)
    .addResources("pt-PT", "translation", pt_PT)
    .addResources("zh-CN", "translation", zh_CN);
});

describe("i18n env is unset", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en-US");
  });

  it("translation of key should match", () =>
    expect(i18n.t("Saving")).toBe("Saving"));

  it("translation if changed to de-DE", async () => {
    await i18n.changeLanguage("de-DE");
    expect(i18n.t("Saving")).toBe("Speichert");
  });

  it("translation if changed to pt-PT", async () => {
    await i18n.changeLanguage("pt-PT");
    expect(i18n.t("Saving")).toBe("A guardar");
  });
});

describe("i18n env is en-US", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en-US");
  });

  it("translation of key should match", () =>
    expect(i18n.t("Saving")).toBe("Saving"));

  it("translation if changed to de-DE", async () => {
    await i18n.changeLanguage("de-DE");
    expect(i18n.t("Saving")).toBe("Speichert");
  });

  it("translation if changed to pt-PT", async () => {
    await i18n.changeLanguage("pt-PT");
    expect(i18n.t("Saving")).toBe("A guardar");
  });
});

describe("i18n env is de-DE", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de-DE");
  });

  it("translation of key should match", () =>
    expect(i18n.t("Saving")).toBe("Speichert"));

  it("translation if changed to en-US", async () => {
    await i18n.changeLanguage("en-US");
    expect(i18n.t("Saving")).toBe("Saving");
  });

  it("translation if changed to pt-PT", async () => {
    await i18n.changeLanguage("pt-PT");
    expect(i18n.t("Saving")).toBe("A guardar");
  });
});

describe("i18n env is pt-PT", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-PT");
  });

  it("translation of key should match", () =>
    expect(i18n.t("Saving")).toBe("A guardar"));

  it("translation if changed to en-US", async () => {
    await i18n.changeLanguage("en-US");
    expect(i18n.t("Saving")).toBe("Saving");
  });

  it("translation if changed to de-DE", async () => {
    await i18n.changeLanguage("de-DE");
    expect(i18n.t("Saving")).toBe("Speichert");
  });
});

describe("Simplified Chinese catalog", () => {
  it("covers the extracted UI catalog so new upstream keys cannot silently fall back to English", () => {
    const missing = Object.keys(en_US).filter((key) => !(key in zh_CN));
    expect(missing).toEqual([]);
  });

  it("translates settings and interpolates AI and drag announcements", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(i18n.t("Back to app")).toBe("返回应用");
    expect(i18n.t("Sign in")).toBe("登录");
    expect(i18n.t("Add passkey")).toBe("添加通行密钥");
    expect(i18n.t("Picked up {{ title }}", { title: "测试文档" })).toBe(
      "开始拖动 测试文档"
    );
    for (const count of [0, 1, 2]) {
      expect(i18n.t("{{ count }} not indexed yet.", { count })).toBe(
        `还有 ${count} 篇尚未建索引。`
      );
    }
  });
});
