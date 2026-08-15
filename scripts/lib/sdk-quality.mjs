/** Validate version-bound SDK quality and canonical-spec evidence. */
export function validateSdkQuality(slug, sdk) {
  const quality = sdk.quality;
  const packageMetadata = sdk.package;
  if (packageMetadata.status === "published" && !quality) {
    throw new Error(`${slug}: published SDK requires quality evidence`);
  }
  if (!quality) return;
  if (quality.testedVersion !== packageMetadata.version) {
    throw new Error(`${slug}: quality.testedVersion must match package.version`);
  }
  if (
    quality.unitTests.total <= 0 ||
    quality.unitTests.passed !== quality.unitTests.total ||
    quality.unitTests.skipped !== 0
  ) {
    throw new Error(
      `${slug}: SDK quality requires a 100% unit-test pass rate with zero skipped tests`,
    );
  }
  if (quality.e2eStatus !== "passed") {
    throw new Error(`${slug}: SDK quality E2E status must be passed`);
  }
  if (!Array.isArray(quality.nodeVersions) || quality.nodeVersions.length === 0) {
    throw new Error(`${slug}: SDK quality requires tested Node.js versions`);
  }
  if (!/^[a-f0-9]{40}$/.test(quality.sourceCommit)) {
    throw new Error(`${slug}: quality.sourceCommit must be a full Git commit`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(quality.testedAt)) {
    throw new Error(`${slug}: quality.testedAt must be an ISO date`);
  }
  const repositoryUrl = new URL(quality.repositoryUrl);
  const workflowRunUrl = new URL(quality.workflowRunUrl);
  if (repositoryUrl.protocol !== "https:" || repositoryUrl.hostname !== "github.com") {
    throw new Error(`${slug}: quality.repositoryUrl must be a GitHub HTTPS URL`);
  }
  if (
    workflowRunUrl.origin !== repositoryUrl.origin ||
    !workflowRunUrl.pathname.startsWith(`${repositoryUrl.pathname}/actions/runs/`)
  ) {
    throw new Error(`${slug}: quality.workflowRunUrl must belong to the SDK repository`);
  }
}
