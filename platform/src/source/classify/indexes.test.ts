// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SourceTree, SourceTreeBlobEntry } from "../types";
import { loadFixtureTree } from "./fixture-tree.test-helper";
import {
  buildSourceContexts,
  buildSourceLessons,
  buildSourceProjects,
  listFirstLevelDirectories,
} from "./indexes";

const SNAPSHOT_ID = "snapshot-test";

function blob(path: string, blobSha: string, size = 1): SourceTreeBlobEntry {
  return { type: "blob", path, blobSha, size, mode: "100644" };
}

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);

const SYNTHETIC_TREE: SourceTree = {
  commitSha: "0".repeat(40),
  truncated: false,
  entries: [
    blob("content/projects/sample-project/README.md", SHA_A),
    blob("content/projects/sample-project/README.es.md", SHA_B),
    blob("content/projects/sample-project/learn.json", SHA_C),
    blob("content/projects/sample-project/.learn/preview.png", SHA_A, 10),
    blob("content/projects/other-project/README.md", SHA_B),
    blob("content/contexts/sample-context/CONTEXT-acme.es.md", SHA_A),
    blob("content/contexts/sample-context/CONTEXT-acme.md", SHA_B),
    blob("content/contexts/sample-context/nested/CONTEXT-nested.en.md", SHA_C),
    blob("content/lessons/sample-lesson/sample-lesson.md", SHA_A),
    blob("content/lessons/sample-lesson/sample-lesson.es.md", SHA_B),
    blob("content/labs/ignored.md", SHA_C),
  ],
};

describe("listFirstLevelDirectories", () => {
  it("deriva solo carpetas de primer nivel bajo la raíz", () => {
    expect(
      listFirstLevelDirectories(SYNTHETIC_TREE, "content/projects"),
    ).toEqual([
      "content/projects/other-project",
      "content/projects/sample-project",
    ]);
    expect(
      listFirstLevelDirectories(SYNTHETIC_TREE, "content/lessons"),
    ).toEqual(["content/lessons/sample-lesson"]);
  });
});

describe("buildSourceProjects", () => {
  it("construye índices mínimos con hechos del árbol", () => {
    const projects = buildSourceProjects(SYNTHETIC_TREE, SNAPSHOT_ID);
    expect(projects.map((project) => project.sourcePath)).toEqual([
      "content/projects/other-project",
      "content/projects/sample-project",
    ]);

    const sample = projects[1];
    expect(sample?.snapshotId).toBe(SNAPSHOT_ID);
    expect(sample?.title).toBeNull();
    expect(sample?.canonicalOrder).toBeNull();
    expect(sample?.preferredReadmePath).toBe(
      "content/projects/sample-project/README.es.md",
    );
    expect(sample?.language).toBe("es");
    expect(sample?.languageEvidence).toBe("suffix");
    expect(sample?.metadata.preferredReadmeBlobSha).toBe(SHA_B);
    expect(sample?.metadata.hasLearnJson).toBe(true);
    expect(sample?.metadata.learnJsonBlobSha).toBe(SHA_C);

    const other = projects[0];
    expect(other?.preferredReadmePath).toBe(
      "content/projects/other-project/README.md",
    );
    expect(other?.language).toBeNull();
    expect(other?.languageEvidence).toBeNull();
    expect(other?.metadata.hasLearnJson).toBe(false);
    expect(other?.metadata.learnJsonBlobSha).toBeNull();
  });

  it("no incluye archivos sueltos ni subcarpetas como proyectos", () => {
    const withRootFiles: SourceTree = {
      ...SYNTHETIC_TREE,
      entries: [
        blob("content/projects/README.md", SHA_A),
        blob("content/projects/learn.json", SHA_B),
        blob("content/projects/sample-project/README.md", SHA_C),
      ],
    };
    expect(
      buildSourceProjects(withRootFiles, SNAPSHOT_ID).map(
        (project) => project.sourcePath,
      ),
    ).toEqual(["content/projects/sample-project"]);
  });
});

describe("buildSourceContexts", () => {
  it("prefiere CONTEXT-*.es.md y agrega todos los CONTEXT-* como metadata", () => {
    const contexts = buildSourceContexts(SYNTHETIC_TREE, SNAPSHOT_ID);
    expect(contexts).toHaveLength(1);
    const sample = contexts[0];
    expect(sample?.sourcePath).toBe("content/contexts/sample-context");
    expect(sample?.title).toBeNull();
    expect(sample?.preferredReadmePath).toBe(
      "content/contexts/sample-context/CONTEXT-acme.es.md",
    );
    expect(sample?.language).toBe("es");
    expect(sample?.metadata.preferredDocumentBlobSha).toBe(SHA_A);
    expect(sample?.metadata.contextDocumentPaths).toEqual([
      "content/contexts/sample-context/CONTEXT-acme.es.md",
      "content/contexts/sample-context/CONTEXT-acme.md",
      "content/contexts/sample-context/nested/CONTEXT-nested.en.md",
    ]);
    expect(sample?.metadata.readmePaths).toEqual([]);
  });
});

describe("buildSourceLessons", () => {
  it("usa el slug del directorio y prefiere .es.md", () => {
    const lessons = buildSourceLessons(SYNTHETIC_TREE, SNAPSHOT_ID);
    expect(lessons).toHaveLength(1);
    const sample = lessons[0];
    expect(sample?.sourcePath).toBe("content/lessons/sample-lesson");
    expect(sample?.title).toBeNull();
    expect(sample?.preferredReadmePath).toBe(
      "content/lessons/sample-lesson/sample-lesson.es.md",
    );
    expect(sample?.language).toBe("es");
    expect(sample?.metadata.preferredDocumentBlobSha).toBe(SHA_B);
    expect(sample?.metadata.documentPaths).toEqual([
      "content/lessons/sample-lesson/sample-lesson.es.md",
      "content/lessons/sample-lesson/sample-lesson.md",
    ]);
  });
});

describe("índices construidos desde fixtures reales", () => {
  const { manifest, tree, fixturePaths } = loadFixtureTree();

  it("indexa el proyecto del fixture con su README preferido y learn.json", () => {
    const readmeEs = fixturePaths.find((fixturePath) =>
      /^content\/projects\/[^/]+\/README\.es\.md$/.test(fixturePath),
    );
    expect(readmeEs).toBeDefined();
    const projectDir = (readmeEs as string).replace(/\/README\.es\.md$/, "");
    const learnJsonPath = `${projectDir}/learn.json`;
    const learnJsonFixture = manifest.fixtures.find(
      (fixture) => fixture.path === learnJsonPath,
    );
    expect(
      learnJsonFixture,
      "el fixture del proyecto debe incluir learn.json",
    ).toBeDefined();

    const projects = buildSourceProjects(tree, SNAPSHOT_ID);
    const project = projects.find(
      (candidate) => candidate.sourcePath === projectDir,
    );
    expect(project).toBeDefined();
    expect(project?.preferredReadmePath).toBe(readmeEs);
    expect(project?.language).toBe("es");
    expect(project?.languageEvidence).toBe("suffix");
    expect(project?.canonicalOrder).toBeNull();
    expect(project?.metadata.preferredReadmeBlobSha).toBe(
      manifest.fixtures.find((fixture) => fixture.path === readmeEs)?.blob_sha,
    );
    expect(project?.metadata.hasLearnJson).toBe(true);
    expect(project?.metadata.learnJsonBlobSha).toBe(learnJsonFixture?.blob_sha);
  });

  it("indexa el contexto del fixture con su par CONTEXT-*", () => {
    const contextEs = fixturePaths.find((fixturePath) =>
      /^content\/contexts\/[^/]+\/CONTEXT-[^/]*\.es\.md$/.test(fixturePath),
    );
    expect(contextEs).toBeDefined();
    const contextBase = (contextEs as string).replace(/\.es\.md$/, ".md");
    expect(fixturePaths).toContain(contextBase);
    const contextDir = (contextEs as string).slice(
      0,
      (contextEs as string).indexOf("/CONTEXT-"),
    );

    const contexts = buildSourceContexts(tree, SNAPSHOT_ID);
    const context = contexts.find(
      (candidate) => candidate.sourcePath === contextDir,
    );
    expect(context).toBeDefined();
    expect(context?.preferredReadmePath).toBe(contextEs);
    expect(context?.language).toBe("es");
    expect(context?.metadata.contextDocumentPaths).toEqual(
      expect.arrayContaining([contextBase, contextEs]),
    );
  });

  it("indexa la lección del fixture con su .es.md", () => {
    const lessonEs = fixturePaths.find((fixturePath) =>
      /^content\/lessons\/[^/]+\/[^/]+\.es\.md$/.test(fixturePath),
    );
    expect(lessonEs).toBeDefined();
    const lessonDir = (lessonEs as string).replace(/\/[^/]+\.es\.md$/, "");

    const lessons = buildSourceLessons(tree, SNAPSHOT_ID);
    const lesson = lessons.find(
      (candidate) => candidate.sourcePath === lessonDir,
    );
    expect(lesson).toBeDefined();
    expect(lesson?.preferredReadmePath).toBe(lessonEs);
    expect(lesson?.language).toBe("es");
  });
});
