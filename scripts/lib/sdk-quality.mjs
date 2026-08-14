/**
 * Validate the version-bound quality evidence used by SDK pages and badges.
 */
export function validateSdkQuality(entry) {
  const quality = entry.sdkQuality;
  if (entry.sdkStatus === "published" && !quality) {
    throw new Error(`${entry.slug}: published SDK requires sdkQuality evidence`);
  }
  if (!quality) return;
  if (quality.testedVersion !== entry.sdkVersion) {
    throw new Error(`${entry.slug}: sdkQuality.testedVersion must match sdkVersion`);
  }
  if (
    quality.unitTests.total <= 0 ||
    quality.unitTests.passed !== quality.unitTests.total ||
    quality.unitTests.skipped !== 0
  ) {
    throw new Error(
      `${entry.slug}: sdkQuality requires a 100% unit-test pass rate with zero skipped tests`,
    );
  }
  if (quality.e2eStatus !== "passed") {
    throw new Error(`${entry.slug}: sdkQuality E2E status must be passed`);
  }
  if (!Array.isArray(quality.nodeVersions) || quality.nodeVersions.length === 0) {
    throw new Error(
      `${entry.slug}: sdkQuality requires at least one tested Node.js version`,
    );
  }
  if (!/^[a-f0-9]{40}$/.test(quality.sourceCommit)) {
    throw new Error(
      `${entry.slug}: sdkQuality.sourceCommit must be a full Git commit`,
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(quality.testedAt)) {
    throw new Error(`${entry.slug}: sdkQuality.testedAt must be an ISO date`);
  }
  const repositoryUrl = new URL(quality.repositoryUrl);
  const workflowRunUrl = new URL(quality.workflowRunUrl);
  if (repositoryUrl.protocol !== "https:" || repositoryUrl.hostname !== "github.com") {
    throw new Error(
      `${entry.slug}: sdkQuality.repositoryUrl must be a GitHub HTTPS URL`,
    );
  }
  if (
    workflowRunUrl.origin !== repositoryUrl.origin ||
    !workflowRunUrl.pathname.startsWith(`${repositoryUrl.pathname}/actions/runs/`)
  ) {
    throw new Error(
      `${entry.slug}: sdkQuality.workflowRunUrl must belong to the SDK repository`,
    );
  }
}
