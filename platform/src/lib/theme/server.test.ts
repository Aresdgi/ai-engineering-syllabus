import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCookie: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.getCookie })),
}));

import { getUiTheme } from "./server";

describe("getUiTheme (server-only)", () => {
  it("lee la cookie `theme` y devuelve `dark`", async () => {
    mocks.getCookie.mockReturnValue({ name: "theme", value: "dark" });

    await expect(getUiTheme()).resolves.toBe("dark");
    expect(mocks.getCookie).toHaveBeenCalledWith("theme");
  });

  it("cookie ausente → system", async () => {
    mocks.getCookie.mockReturnValue(undefined);

    await expect(getUiTheme()).resolves.toBe("system");
  });

  it("cookie con valor inválido → system", async () => {
    mocks.getCookie.mockReturnValue({ name: "theme", value: "sepia" });

    await expect(getUiTheme()).resolves.toBe("system");
  });
});
