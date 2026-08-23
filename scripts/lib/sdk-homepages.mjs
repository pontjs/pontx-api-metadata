export function expectedSdkHomepage(slug) {
  return `https://pontx.dev/en/sdks/${slug}`;
}

export function validatePublishedSdkHomepage(slug, sdk, registryMetadata) {
  const errors = [];
  const expected = expectedSdkHomepage(slug);
  const packageMetadata = sdk.package ?? {};

  if (registryMetadata.name !== packageMetadata.name) {
    errors.push(
      `${slug}: npm package name ${registryMetadata.name ?? "<missing>"} must match ${packageMetadata.name}`,
    );
  }
  if (registryMetadata.version !== packageMetadata.version) {
    errors.push(
      `${slug}: npm version ${registryMetadata.version ?? "<missing>"} must match ${packageMetadata.version}`,
    );
  }
  if (registryMetadata.homepage !== expected) {
    errors.push(
      `${slug}: npm homepage must be ${expected}, received ${registryMetadata.homepage ?? "<missing>"}`,
    );
  }
  if (typeof registryMetadata.readme !== "string" || !registryMetadata.readme.includes(expected)) {
    errors.push(`${slug}: published npm README must link to ${expected}`);
  }
  if (typeof registryMetadata.readme === "string"
    && registryMetadata.readme.includes("pontx-hub.vercel.app")) {
    errors.push(`${slug}: published npm README must not use the retired Pontx Hub hostname`);
  }

  return errors;
}
