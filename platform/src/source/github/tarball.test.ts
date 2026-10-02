// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FileReadError, TarballReadError } from "./errors";
import { GithubSourceReader, normalizeSourcePath } from "./reader";
import {
  bytesResponse,
  createFetchMock,
  createTarGz,
  headerValue,
  textResponse,
  type TarEntrySpec,
} from "./test-helpers";

const OWNER = "sample-owner";
const REPO_NAME = "sample-repo";
const COMMIT_SHA = "c".repeat(40);
const TARBALL_URL = `https://codeload.github.com/${OWNER}/${REPO_NAME}/tar.gz/${COMMIT_SHA}`;
const RAW_ROOT = `https://raw.githubusercontent.com/${OWNER}/${REPO_NAME}/${COMMIT_SHA}`;

const ROOT = `${REPO_NAME}-${COMMIT_SHA}`;

const README_PATH = "README.md";
const ESP_README_PATH = "content/projects/synthetic-project/README.es.md";
const HIDDEN_PATH =
  "content/projects/synthetic-project/.learn/solution/notes.txt";
const BINARY_PATH = "assets/sample.bin";
const SYMLINK_PATH = "content/projects/synthetic-project/link.md";
const SYMLINK_TARGET = "README.es.md";

const LONG_SEGMENT = "nested-segment-with-a-long-name";
const LONG_PATH = `content/lessons/synthetic-lesson/${Array.from(
  { length: 8 },
  () => LONG_SEGMENT,
).join("/")}/notes.md`;

const README_BYTES = "# synthetic readme\n";
const ESP_BYTES = "# contenido sintético\n";
const HIDDEN_BYTES = "synthetic hidden note\n";
const BINARY_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff,
]);
const LONG_BYTES = "long pax path body\n";

const TAR_ENTRIES: TarEntrySpec[] = [
  { name: `${ROOT}/`, type: "directory" },
  { name: `${ROOT}/${README_PATH}`, content: README_BYTES },
  { name: `${ROOT}/${ESP_README_PATH}`, content: ESP_BYTES },
  { name: `${ROOT}/${HIDDEN_PATH}`, content: HIDDEN_BYTES },
  { name: `${ROOT}/${BINARY_PATH}`, content: BINARY_BYTES },
  { name: `${ROOT}/${LONG_PATH}`, content: LONG_BYTES },
  {
    name: `${ROOT}/${SYMLINK_PATH}`,
    type: "symlink",
    linkname: SYMLINK_TARGET,
  },
];

const RAW_FALLBACK_PATH = "content/projects/synthetic-project/only-in-raw.md";
const RAW_FALLBACK_BYTES = "raw fallback body\n";

function expectBytesEqual(actual: Uint8Array, expected: Uint8Array): void {
  expect(Array.from(actual)).toEqual(Array.from(expected));
}

function createReaderWithTarball(
  tarball: Uint8Array,
  options: {
    rawBytes?: ReadonlyMap<string, Uint8Array>;
    token?: string;
    rawFallback?: boolean;
  } = {},
) {
  const mock = createFetchMock((url) => {
    if (url === TARBALL_URL) {
      return bytesResponse(tarball);
    }
    if (url.startsWith(`${RAW_ROOT}/`)) {
      const encoded = url.slice(RAW_ROOT.length + 1);
      const rawPath = encoded
        .split("/")
        .map((segment) => decodeURIComponent(segment))
        .join("/");
      const bytes = options.rawBytes?.get(rawPath);
      return bytes
        ? bytesResponse(bytes)
        : textResponse("Not Found", { status: 404 });
    }
    return textResponse(`unexpected url: ${url}`, { status: 500 });
  });
  const reader = new GithubSourceReader({
    repo: `${OWNER}/${REPO_NAME}`,
    fetchImpl: mock.fetchImpl,
    rawFallback: options.rawFallback,
    token: options.token,
  });
  const tarballCalls = () =>
    mock.calls.filter((call) => call.url === TARBALL_URL);
  const rawCalls = () =>
    mock.calls.filter((call) => call.url.startsWith(RAW_ROOT));
  return { reader, calls: mock.calls, tarballCalls, rawCalls };
}

describe("GithubSourceReader.readFile: tarball (AC-1.4/1.9)", () => {
  it("devuelve bytes idénticos y elimina el prefijo raíz del tarball", async () => {
    const tarball = await createTarGz(TAR_ENTRIES);
    const { reader } = createReaderWithTarball(tarball);

    expectBytesEqual(
      await reader.readFile(COMMIT_SHA, README_PATH),
      new Uint8Array(Buffer.from(README_BYTES)),
    );
    expectBytesEqual(
      await reader.readFile(COMMIT_SHA, ESP_README_PATH),
      new Uint8Array(Buffer.from(ESP_BYTES)),
    );
    expectBytesEqual(
      await reader.readFile(COMMIT_SHA, HIDDEN_PATH),
      new Uint8Array(Buffer.from(HIDDEN_BYTES)),
    );
  });

  it("devuelve bytes binarios exactos sin transformarlos", async () => {
    const tarball = await createTarGz(TAR_ENTRIES);
    const { reader } = createReaderWithTarball(tarball);

    expectBytesEqual(
      await reader.readFile(COMMIT_SHA, BINARY_PATH),
      BINARY_BYTES,
    );
  });

  it("soporta rutas largas (pax) y las conserva completas", async () => {
    expect(LONG_PATH.length).toBeGreaterThan(150);
    const tarball = await createTarGz(TAR_ENTRIES);
    const { reader } = createReaderWithTarball(tarball);

    expectBytesEqual(
      await reader.readFile(COMMIT_SHA, LONG_PATH),
      new Uint8Array(Buffer.from(LONG_BYTES)),
    );
  });

  it("trata los symlinks como su blob git: bytes del destino", async () => {
    const tarball = await createTarGz(TAR_ENTRIES);
    const { reader } = createReaderWithTarball(tarball);

    expectBytesEqual(
      await reader.readFile(COMMIT_SHA, SYMLINK_PATH),
      new Uint8Array(Buffer.from(SYMLINK_TARGET, "utf8")),
    );
  });

  it("descarga el tarball una sola vez por commit y devuelve copias", async () => {
    const tarball = await createTarGz(TAR_ENTRIES);
    const { reader, tarballCalls } = createReaderWithTarball(tarball);

    const first = await reader.readFile(COMMIT_SHA, README_PATH);
    const second = await reader.readFile(COMMIT_SHA, README_PATH);

    expect(tarballCalls()).toHaveLength(1);
    expectBytesEqual(second, first);
    expect(second).not.toBe(first);

    second[0] = 0x00;
    expectBytesEqual(
      await reader.readFile(COMMIT_SHA, README_PATH),
      new Uint8Array(Buffer.from(README_BYTES)),
    );
    expect(tarballCalls()).toHaveLength(1);
  });

  it("no envía el token al codeload (solo la API lo recibe)", async () => {
    const tarball = await createTarGz(TAR_ENTRIES);
    const { reader, tarballCalls } = createReaderWithTarball(tarball, {
      token: "secret-token-value",
    });

    await reader.readFile(COMMIT_SHA, README_PATH);

    expect(headerValue(tarballCalls()[0]!, "authorization")).toBeNull();
  });
});

describe("GithubSourceReader.readFile: fallback raw por archivo", () => {
  it("usa raw.githubusercontent.com cuando el path no está en el tarball", async () => {
    const tarball = await createTarGz(TAR_ENTRIES);
    const rawBytes = new Map<string, Uint8Array>([
      [RAW_FALLBACK_PATH, new Uint8Array(Buffer.from(RAW_FALLBACK_BYTES))],
    ]);
    const { reader, rawCalls } = createReaderWithTarball(tarball, { rawBytes });

    expectBytesEqual(
      await reader.readFile(COMMIT_SHA, RAW_FALLBACK_PATH),
      new Uint8Array(Buffer.from(RAW_FALLBACK_BYTES)),
    );
    expect(rawCalls()).toHaveLength(1);
    expect(rawCalls()[0]?.url).toBe(`${RAW_ROOT}/${RAW_FALLBACK_PATH}`);
  });

  it("falla con FileReadError si ni el tarball ni raw tienen el path", async () => {
    const tarball = await createTarGz(TAR_ENTRIES);
    const { reader, rawCalls } = createReaderWithTarball(tarball);

    const error = await reader
      .readFile(COMMIT_SHA, RAW_FALLBACK_PATH)
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(FileReadError);
    const typed = error as FileReadError;
    expect(typed.kind).toBe("file-read-failed");
    expect(typed.commitSha).toBe(COMMIT_SHA);
    expect(typed.path).toBe(RAW_FALLBACK_PATH);
    expect(typed.message).toContain(RAW_FALLBACK_PATH);
    expect(rawCalls()).toHaveLength(1);
  });

  it("rawFallback=false no llama a raw y falla con FileReadError", async () => {
    const tarball = await createTarGz(TAR_ENTRIES);
    const { reader, rawCalls } = createReaderWithTarball(tarball, {
      rawFallback: false,
    });

    await expect(
      reader.readFile(COMMIT_SHA, RAW_FALLBACK_PATH),
    ).rejects.toBeInstanceOf(FileReadError);
    expect(rawCalls()).toHaveLength(0);
  });

  it("si el tarball falla, raw cubre el archivo y el tarball no se reintenta en bucle", async () => {
    const rawBytes = new Map<string, Uint8Array>([
      [RAW_FALLBACK_PATH, new Uint8Array(Buffer.from(RAW_FALLBACK_BYTES))],
      [README_PATH, new Uint8Array(Buffer.from(README_BYTES))],
    ]);
    const mock = createFetchMock((url) => {
      if (url === TARBALL_URL) {
        return textResponse("Server Error", { status: 500 });
      }
      const encoded = url.slice(RAW_ROOT.length + 1);
      const rawPath = encoded
        .split("/")
        .map((segment) => decodeURIComponent(segment))
        .join("/");
      const bytes = rawBytes.get(rawPath);
      return bytes
        ? bytesResponse(bytes)
        : textResponse("Not Found", { status: 404 });
    });
    const reader = new GithubSourceReader({
      repo: `${OWNER}/${REPO_NAME}`,
      fetchImpl: mock.fetchImpl,
    });

    expectBytesEqual(
      await reader.readFile(COMMIT_SHA, RAW_FALLBACK_PATH),
      new Uint8Array(Buffer.from(RAW_FALLBACK_BYTES)),
    );
    expectBytesEqual(
      await reader.readFile(COMMIT_SHA, README_PATH),
      new Uint8Array(Buffer.from(README_BYTES)),
    );
    expect(mock.calls.filter((call) => call.url === TARBALL_URL)).toHaveLength(
      1,
    );
    expect(
      mock.calls.filter((call) => call.url.startsWith(RAW_ROOT)),
    ).toHaveLength(2);
  });

  it("con rawFallback=false un tarball corrupto falla con causa TarballReadError", async () => {
    const { reader } = createReaderWithTarball(
      new Uint8Array([1, 2, 3, 4, 5]),
      { rawFallback: false },
    );

    const error = await reader
      .readFile(COMMIT_SHA, README_PATH)
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(FileReadError);
    expect((error as FileReadError).cause).toBeInstanceOf(TarballReadError);
  });
});

describe("GithubSourceReader.readFile: validación de entrada", () => {
  it("normaliza paths válidos y rechaza paths peligrosos o malformados", () => {
    expect(
      normalizeSourcePath("content/projects/synthetic-project/README.md"),
    ).toBe("content/projects/synthetic-project/README.md");
    expect(normalizeSourcePath("./content/README.md")).toBe(
      "content/README.md",
    );
    expect(normalizeSourcePath("")).toBeNull();
    expect(normalizeSourcePath("/etc/passwd")).toBeNull();
    expect(normalizeSourcePath("content/../secret")).toBeNull();
    expect(normalizeSourcePath("content/./README.md")).toBeNull();
    expect(normalizeSourcePath("content\\windows.md")).toBeNull();
  });

  it("rechaza un path inválido sin descargar el tarball", async () => {
    const tarball = await createTarGz(TAR_ENTRIES);
    const { reader, calls } = createReaderWithTarball(tarball);

    await expect(
      reader.readFile(COMMIT_SHA, "content/../secret.md"),
    ).rejects.toBeInstanceOf(FileReadError);
    expect(calls).toHaveLength(0);
  });

  it("rechaza un commitSha que no es SHA-1 de 40 hex", async () => {
    const tarball = await createTarGz(TAR_ENTRIES);
    const { reader, calls } = createReaderWithTarball(tarball);

    await expect(
      reader.readFile("no-es-sha", README_PATH),
    ).rejects.toBeInstanceOf(FileReadError);
    expect(calls).toHaveLength(0);
  });
});
