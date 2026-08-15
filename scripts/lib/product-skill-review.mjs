export const PRODUCT_SKILL_REVIEW_CHECKS = new Set([
  "officialEvidenceOnly",
  "evidenceMatchesSkillClaims",
  "metadataContractConsistent",
  "noMetadataDuplication",
  "cliSdkExamplesValid",
  "safetyBoundariesPresent",
  "budgetWithinLimits",
  "versionBumped",
  "registryDeterministic",
  "promptInjectionIgnored",
]);

export function verifyProductSkillReviewDecision({ review, head, expectedClaims }) {
  const errors = [];
  const exactKeys = (value, expected, context) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${context} must be an object`);
      return;
    }
    const actual = Object.keys(value).sort();
    if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
      errors.push(`${context} fields must be exactly ${[...expected].join(", ")}`);
    }
  };

  exactKeys(review, new Set(["commitSha", "verdict", "findings", "verifiedClaims", "checks"]), "review");
  if (review?.commitSha !== head.toLowerCase()) errors.push("review commitSha does not match the current PR head");
  if (review?.verdict !== "pass") errors.push("independent reviewer did not return pass");
  if (!Array.isArray(review?.findings)) {
    errors.push("findings must be an array");
  } else {
    for (const finding of review.findings) {
      exactKeys(finding, new Set(["severity", "code", "message", "path"]), "review finding");
      if (!new Set(["blocker", "major", "minor"]).has(finding?.severity)) {
        errors.push(`invalid finding severity ${finding?.severity}`);
      }
    }
    if (review.findings.some((finding) => finding?.severity === "blocker" || finding?.severity === "major")) {
      errors.push("review contains blocker or major findings");
    }
  }
  exactKeys(review?.checks, PRODUCT_SKILL_REVIEW_CHECKS, "review.checks");
  for (const check of PRODUCT_SKILL_REVIEW_CHECKS) {
    if (review?.checks?.[check] !== true) errors.push(`review check ${check} did not pass`);
  }

  const actualClaims = new Map();
  if (!Array.isArray(review?.verifiedClaims)) {
    errors.push("verifiedClaims must be an array");
  } else {
    for (const claim of review.verifiedClaims) {
      exactKeys(claim, new Set(["skillName", "claimId", "sourceUrl", "verdict"]), "verified claim");
      const key = `${claim?.skillName}#${claim?.claimId}`;
      if (actualClaims.has(key)) errors.push(`duplicate reviewed claim ${key}`);
      actualClaims.set(key, claim);
    }
  }
  for (const [key, sourceUrl] of expectedClaims) {
    const claim = actualClaims.get(key);
    if (!claim) {
      errors.push(`review omitted evidence claim ${key}`);
    } else {
      if (claim.sourceUrl !== sourceUrl) errors.push(`review source URL differs for ${key}`);
      if (claim.verdict !== "verified") errors.push(`review did not verify ${key}: ${claim.verdict}`);
    }
  }
  for (const key of actualClaims.keys()) {
    if (!expectedClaims.has(key)) errors.push(`review returned undeclared evidence claim ${key}`);
  }
  return errors;
}
