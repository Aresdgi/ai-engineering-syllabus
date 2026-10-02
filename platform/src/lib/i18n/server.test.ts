import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCookie: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.getCookie })),
}));

import { getUiLanguage } from "./server";

describe("getUiLanguage (server-only)", () => {
  it("lee la cookie `lang` y devuelve `en`", async () => {
    mocks.getCookie.mockReturnValue({ name: "lang", value: "en" });

    await expect(getUiLanguage()).resolves.toBe("en");
    expect(mocks.getCookie).toHaveBeenCalledWith("lang");
  });

  it("cookie ausente → es", async () => {
    mocks.getCookie.mockReturnValue(undefined);

    await expect(getUiLanguage()).resolves.toBe("es");
  });

  it("cookie con valor inválido → es", async () => {
    mocks.getCookie.mockReturnValue({ name: "lang", value: "fr" });

    await expect(getUiLanguage()).resolves.toBe("es");
  });
});
