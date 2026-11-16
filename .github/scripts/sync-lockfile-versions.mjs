// Writes the release version into bun.lock for each workspace release-please
// bumps (Issue #133). bun.lock records every workspace's version, and
// release-please cannot rewrite it: bun.lock has trailing commas, so it is not
// the JSON release-please's json updater parses. Left alone, the first
// `bun install` after a release rewrites bun.lock in every clone.
//
// Not `bun install --lockfile-only`: every install in CI is frozen to the
// committed lockfile (Issue #18), and only the version lines need to change.
// release.yml runs this on the release pull request's branch.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * bun.lock's text with each workspace's version set.
 * @param {string} lockText
 * @param {Record<string, string>} versions workspace path → version
 */
export const syncLockfileVersions = (lockText, versions) => {
  let synced = lockText;
  for (const [workspace, version] of Object.entries(versions)) {
    // The workspace key, then its name, then its version, as bun writes them.
    const entry = new RegExp(
      `("${escape(workspace)}": \\{\\r?\\n\\s*"name": "[^"]*",\\r?\\n\\s*"version": ")[^"]*(")`,
    );
    if (!entry.test(synced)) {
      throw new Error(
        `bun.lock has no versioned workspace entry for ${workspace}.`,
      );
    }
    synced = synced.replace(entry, `$1${version}$2`);
  }
  return synced;
};

/** The workspaces release-please versions, from its configuration. */
const versionedWorkspaces = (config) =>
  (config.packages["."]["extra-files"] ?? [])
    .filter(
      (file) => file.type === "json" && file.path.endsWith("/package.json"),
    )
    .map((file) => file.path.slice(0, -"/package.json".length));

const main = () => {
  const config = JSON.parse(readFileSync("release-please-config.json", "utf8"));
  const versions = Object.fromEntries(
    versionedWorkspaces(config).map((workspace) => [
      workspace,
      JSON.parse(readFileSync(`${workspace}/package.json`, "utf8")).version,
    ]),
  );
  const lockText = readFileSync("bun.lock", "utf8");
  const synced = syncLockfileVersions(lockText, versions);
  if (synced !== lockText) {
    writeFileSync("bun.lock", synced);
  }
  console.log(`bun.lock versions: ${JSON.stringify(versions)}`);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
