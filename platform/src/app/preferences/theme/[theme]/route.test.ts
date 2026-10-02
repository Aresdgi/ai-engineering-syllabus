import { describe, expect, it } from "vitest";

import { GET } from "./route";

function get(path: string, theme: string): Promise<Response> {
  return GET(new Request(`http://localhost${path}`), {
    params: Promise.resolve({ theme }),
  });
}

describe("GET /preferences/theme/[theme]", () => {
  it("fija la cookie y redirige con 303 a un next interno", async () => {
    const response = await get(
      "/preferences/theme/dark?next=/contexts",
      "dark",
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/contexts");
    expect(response.headers.get("set-cookie")).toBe(
      "theme=dark; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("acepta light y system", async () => {
    const light = await get("/preferences/theme/light?next=/lessons", "light");
    expect(light.status).toBe(303);
    expect(light.headers.get("set-cookie")).toContain("theme=light");

    const system = await get("/preferences/theme/system", "system");
    expect(system.status).toBe(303);
    expect(system.headers.get("set-cookie")).toContain("theme=system");
    expect(system.headers.get("location")).toBe("/projects");
  });

  it.each([
    ["//evil.example/steal", "/projects"],
    ["https://evil.example/steal", "/projects"],
    ["javascript:alert(1)", "/projects"],
    ["/\\evil.example", "/projects"],
    ["contexts", "/projects"],
  ])("open redirect: next=%s → %s", async (next, expected) => {
    const response = await get(
      `/preferences/theme/dark?next=${encodeURIComponent(next)}`,
      "dark",
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(expected);
  });

  it("tema inválido → 404 sin cookie", async () => {
    const response = await get(
      "/preferences/theme/sepia?next=/contexts",
      "sepia",
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
