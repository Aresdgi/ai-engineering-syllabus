// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  classifySourcePath,
  listDirectContextDocuments,
  resolvePreferredContextDocument,
  resolvePreferredLessonDocument,
  resolvePreferredProjectReadme,
  resolveSourceLanguage,
} from "./paths";

function paths(...values: string[]): ReadonlySet<string> {
  return new Set(values);
}

describe("classifySourcePath (bucket)", () => {
  it.each([
    ["content/projects", "projects"],
    ["content/projects/sample-project", "projects"],
    ["content/projects/sample-project/README.md", "projects"],
    ["content/projects-extra/README.md", "auxiliary"],
    ["content/contexts", "contexts"],
    ["content/contexts/sample-context/CONTEXT-acme.md", "contexts"],
    ["content/lessons", "lessons"],
    ["content/lessons/sample-lesson/sample-lesson.md", "lessons"],
    ["content/README.md", "auxiliary"],
    ["marketing/README.md", "auxiliary"],
    ["docs/syllabus/plan.csv", "auxiliary"],
  ])("clasifica %s como %s", (sourcePath, bucket) => {
    expect(classifySourcePath(sourcePath)).toBe(bucket);
  });
});

describe("resolveSourceLanguage (path + convención, nunca contenido)", () => {
  it("asigna es/suffix a los .es.md", () => {
    expect(
      resolveSourceLanguage("content/projects/x/README.es.md", paths()),
    ).toEqual({
      language: "es",
      languageEvidence: "suffix",
    });
  });

  it("asigna en/suffix a los .en.md", () => {
    expect(
      resolveSourceLanguage("content/contexts/x/CONTEXT-acme.en.md", paths()),
    ).toEqual({ language: "en", languageEvidence: "suffix" });
  });

  it("asigna en/pair-convention a X.md cuando existe X.es.md", () => {
    expect(
      resolveSourceLanguage(
        "content/projects/x/README.md",
        paths(
          "content/projects/x/README.md",
          "content/projects/x/README.es.md",
        ),
      ),
    ).toEqual({ language: "en", languageEvidence: "pair-convention" });
  });

  it("no inventa idioma para X.md sin par español", () => {
    expect(
      resolveSourceLanguage(
        "content/projects/x/README.md",
        paths("content/projects/x/README.md"),
      ),
    ).toEqual({ language: null, languageEvidence: null });
  });

  it("no asigna idioma a formatos no markdown", () => {
    expect(
      resolveSourceLanguage("content/projects/x/learn.json", paths()).language,
    ).toBeNull();
  });
});

describe("documentos preferidos", () => {
  it("proyecto: README.es.md gana a README.md", () => {
    expect(
      resolvePreferredProjectReadme(
        "content/projects/x",
        paths(
          "content/projects/x/README.md",
          "content/projects/x/README.es.md",
        ),
      ),
    ).toBe("content/projects/x/README.es.md");
  });

  it("proyecto: cae a README.md si no hay español", () => {
    expect(
      resolvePreferredProjectReadme(
        "content/projects/x",
        paths("content/projects/x/README.md"),
      ),
    ).toBe("content/projects/x/README.md");
  });

  it("proyecto: null si no hay README", () => {
    expect(
      resolvePreferredProjectReadme(
        "content/projects/x",
        paths("content/projects/x/learn.json"),
      ),
    ).toBeNull();
  });

  it("lección: usa el slug del directorio y prefiere .es.md", () => {
    expect(
      resolvePreferredLessonDocument(
        "content/lessons/sample-lesson",
        paths(
          "content/lessons/sample-lesson/sample-lesson.md",
          "content/lessons/sample-lesson/sample-lesson.es.md",
        ),
      ),
    ).toBe("content/lessons/sample-lesson/sample-lesson.es.md");
  });

  it("lección: cae a .md y luego a .en.md", () => {
    expect(
      resolvePreferredLessonDocument(
        "content/lessons/sample-lesson",
        paths("content/lessons/sample-lesson/sample-lesson.md"),
      ),
    ).toBe("content/lessons/sample-lesson/sample-lesson.md");
    expect(
      resolvePreferredLessonDocument(
        "content/lessons/sample-lesson",
        paths("content/lessons/sample-lesson/sample-lesson.en.md"),
      ),
    ).toBe("content/lessons/sample-lesson/sample-lesson.en.md");
  });

  it("contexto: README.es.md gana; si no, README.md", () => {
    expect(
      resolvePreferredContextDocument(
        "content/contexts/x",
        paths(
          "content/contexts/x/README.md",
          "content/contexts/x/README.es.md",
          "content/contexts/x/CONTEXT-acme.es.md",
        ),
      ),
    ).toBe("content/contexts/x/README.es.md");
    expect(
      resolvePreferredContextDocument(
        "content/contexts/x",
        paths(
          "content/contexts/x/README.md",
          "content/contexts/x/CONTEXT-acme.es.md",
        ),
      ),
    ).toBe("content/contexts/x/README.md");
  });

  it("contexto: sin README prefiere CONTEXT-*.es.md sobre .en.md y .md", () => {
    expect(
      resolvePreferredContextDocument(
        "content/contexts/x",
        paths(
          "content/contexts/x/CONTEXT-acme.md",
          "content/contexts/x/CONTEXT-acme.en.md",
          "content/contexts/x/CONTEXT-acme.es.md",
        ),
      ),
    ).toBe("content/contexts/x/CONTEXT-acme.es.md");
    expect(
      resolvePreferredContextDocument(
        "content/contexts/x",
        paths(
          "content/contexts/x/CONTEXT-bravo.md",
          "content/contexts/x/CONTEXT-bravo.en.md",
        ),
      ),
    ).toBe("content/contexts/x/CONTEXT-bravo.en.md");
  });

  it("contexto: null si no hay documento reconocible", () => {
    expect(
      resolvePreferredContextDocument(
        "content/contexts/x",
        paths("content/contexts/x/data.csv"),
      ),
    ).toBeNull();
  });
});

describe("listDirectContextDocuments", () => {
  it("solo lista CONTEXT-*.md hijos directos y ordena", () => {
    const direct = listDirectContextDocuments(
      "content/contexts/x",
      paths(
        "content/contexts/x/CONTEXT-bravo.md",
        "content/contexts/x/CONTEXT-acme.es.md",
        "content/contexts/x/nested/CONTEXT-nested.md",
        "content/contexts/x/README.md",
      ),
    );
    expect(direct).toEqual([
      "content/contexts/x/CONTEXT-acme.es.md",
      "content/contexts/x/CONTEXT-bravo.md",
    ]);
  });
});
