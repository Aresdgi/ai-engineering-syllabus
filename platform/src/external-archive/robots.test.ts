// @vitest-environment node
import { describe, expect, it } from "vitest";

import { HttpClient, type FetchLike } from "./http";
import { isPathAllowed, parseRobotsTxt, RobotsGate } from "./robots";

function createFetchMock(routes: Readonly<Record<string, () => Response>>): {
  fetch: FetchLike;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (input) => {
    calls.push(input);
    const route = routes[input];
    if (route === undefined) {
      throw new Error(`fetch no mockeado: ${input}`);
    }
    return route();
  };
  return { fetch: fetchImpl, calls };
}

function gateWith(routes: Readonly<Record<string, () => Response>>): {
  gate: RobotsGate;
  calls: string[];
} {
  const mock = createFetchMock(routes);
  const http = new HttpClient({
    fetch: mock.fetch,
    retries: 0,
    sleep: async () => undefined,
  });
  return { gate: new RobotsGate(http), calls: mock.calls };
}

const FOUR_GEEKS_ROBOTS = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /api/",
  "Disallow: /private/",
  "Disallow: /preview-frame",
  "Disallow: /health",
  "",
].join("\n");

describe("parseRobotsTxt / isPathAllowed", () => {
  it("aplica la regla de prefijo más larga con Allow ganando empates", () => {
    const groups = parseRobotsTxt(FOUR_GEEKS_ROBOTS);
    expect(isPathAllowed(groups, "/lesson/x", "ai-engineering-syllabus")).toBe(
      true,
    );
    expect(
      isPathAllowed(groups, "/api/v1/registry", "ai-engineering-syllabus"),
    ).toBe(false);
    expect(isPathAllowed(groups, "/private/x", "ai-engineering-syllabus")).toBe(
      false,
    );
  });

  it("sin reglas aplicables permite todo", () => {
    expect(isPathAllowed([], "/cualquiera", "token")).toBe(true);
    expect(
      isPathAllowed(parseRobotsTxt("User-agent: *\nDisallow:"), "/x", "token"),
    ).toBe(true);
  });

  it("Disallow: / prohíbe todo el host", () => {
    const groups = parseRobotsTxt("User-agent: *\nDisallow: /\n");
    expect(isPathAllowed(groups, "/", "token")).toBe(false);
    expect(isPathAllowed(groups, "/lesson/x", "token")).toBe(false);
  });

  it("el grupo específico del product token prevalece sobre el comodín", () => {
    const groups = parseRobotsTxt(
      [
        "User-agent: *",
        "Disallow: /",
        "",
        "User-agent: ai-engineering-syllabus-external-archive",
        "Allow: /",
        "",
      ].join("\n"),
    );
    expect(
      isPathAllowed(
        groups,
        "/lesson/x",
        "ai-engineering-syllabus-external-archive",
      ),
    ).toBe(true);
    expect(isPathAllowed(groups, "/lesson/x", "otro-bot")).toBe(false);
  });
});

describe("RobotsGate", () => {
  it("learn.4geeks.com NUNCA se pide, ni siquiera su robots.txt", async () => {
    const { gate, calls } = gateWith({});
    const verdict = await gate.check("https://learn.4geeks.com/lesson/x");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("blocked");
    expect(calls).toEqual([]);
  });

  it("4geeks.com/api/* tampoco se pide", async () => {
    const { gate, calls } = gateWith({});
    const verdict = await gate.check("https://4geeks.com/api/v1/registry");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("blocked");
    expect(calls).toEqual([]);
  });

  it("un robots.txt 404 deja pasar (sin restricciones declaradas)", async () => {
    const { gate, calls } = gateWith({
      "https://raw.githubusercontent.com/robots.txt": () =>
        new Response(null, { status: 404 }),
    });
    const verdict = await gate.check(
      "https://raw.githubusercontent.com/breatheco-de/knowledge-base/main/a.md",
    );
    expect(verdict.allowed).toBe(true);
    expect(verdict.reason).toBe("allowed");
    expect(calls).toHaveLength(1);
  });

  it("un robots.txt con Disallow bloquea la ruta concreta", async () => {
    const { gate } = gateWith({
      "https://example.com/robots.txt": () =>
        new Response(FOUR_GEEKS_ROBOTS, { status: 200 }),
    });
    expect((await gate.check("https://example.com/lesson/x")).allowed).toBe(
      true,
    );
    expect((await gate.check("https://example.com/api/v1")).allowed).toBe(
      false,
    );
  });

  it("fail-closed: 429/5xx o error de red no se pide", async () => {
    const serverError = gateWith({
      "https://example.com/robots.txt": () =>
        new Response(null, { status: 503 }),
    });
    expect(
      (await serverError.gate.check("https://example.com/x")).allowed,
    ).toBe(false);

    const network = gateWith({
      "https://example.com/robots.txt": () => {
        throw new Error("boom");
      },
    });
    expect((await network.gate.check("https://example.com/x")).allowed).toBe(
      false,
    );
  });

  it("cachea el robots.txt por origen", async () => {
    const { gate, calls } = gateWith({
      "https://example.com/robots.txt": () =>
        new Response("User-agent: *\nAllow: /\n", { status: 200 }),
    });
    expect((await gate.check("https://example.com/a")).allowed).toBe(true);
    expect((await gate.check("https://example.com/b")).allowed).toBe(true);
    expect(calls).toEqual(["https://example.com/robots.txt"]);
  });
});
