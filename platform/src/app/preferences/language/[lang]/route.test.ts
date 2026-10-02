import { describe, expect, it } from "vitest";

import { GET } from "./route";

function get(path: string, lang: string): Promise<Response> {
  return GET(new Request(`http://localhost${path}`), {
    params: Promise.resolve({ lang }),
  });
}

describe("GET /preferences/language/[lang]", () => {
  it("fija la cookie y redirige con 303 a un next interno", async () => {
    const response = await get("/preferences/language/en?next=/contexts", "en");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/contexts");
    expect(response.headers.get("set-cookie")).toBe(
      "lang=en; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("funciona sin next: cae a /projects", async () => {
    const response = await get("/preferences/language/es", "es");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/projects");
    expect(response.headers.get("set-cookie")).toContain("lang=es");
  });

  it.each([
    ["//evil.example/steal", "/projects"],
    ["https://evil.example/steal", "/projects"],
    ["javascript:alert(1)", "/projects"],
    ["/\\evil.example", "/projects"],
    ["contexts", "/projects"],
  ])("open redirect: next=%s → %s", async (next, expected) => {
    const response = await get(
      `/preferences/language/en?next=${encodeURIComponent(next)}`,
      "en",
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(expected);
  });

  it("conserva path+query internos al redirigir", async () => {
    const response = await get(
      "/preferences/language/en?next=%2Fcontexts%2Falpha-unit%3Fdoc%3Dguia.md%26lang%3Des",
      "en",
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/contexts/alpha-unit?doc=guia.md&lang=es",
    );
  });

  it("idioma inválido → 404 sin cookie", async () => {
    const response = await get("/preferences/language/fr?next=/contexts", "fr");

    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
