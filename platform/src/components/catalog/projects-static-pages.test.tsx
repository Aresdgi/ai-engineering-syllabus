import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: navigation.redirect,
}));

import Home from "@/app/page";

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  navigation.redirect.mockClear();
});

describe("Home", () => {
  it("redirige al índice de proyectos hasta que exista el dashboard de H3", () => {
    expect(() => Home()).toThrow("NEXT_REDIRECT:/projects");
    expect(navigation.redirect).toHaveBeenCalledWith("/projects");
  });
});
