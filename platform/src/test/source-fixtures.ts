/**
 * Reexport de compatibilidad para los tests: la implementación vive en
 * `platform/src/source/fixtures/` (código de producción) desde F-03, de modo
 * que la ingesta no depende de `src/test/`.
 */
export {
  computeGitBlobSha,
  parseSourceFixtureManifest,
  SOURCE_FIXTURES_MANIFEST_NAME,
  SOURCE_FIXTURES_RELATIVE_DIR,
  SOURCE_FIXTURES_REPOSITORY,
  verifySourceFixtures,
  type SourceFixtureEntry,
  type SourceFixtureManifest,
  type SourceFixtureManifestParseResult,
  type SourceFixtureVerification,
  type SourceFixtureViolation,
  type SourceFixtureViolationKind,
} from "../source/fixtures";
