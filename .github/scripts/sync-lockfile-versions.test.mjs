import assert from "node:assert/strict";
import { test } from "node:test";

import { syncLockfileVersions } from "./sync-lockfile-versions.mjs";

const lockfile = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "zipnami",
    },
    "apps/web/backend": {
      "name": "@zipnami/web-backend",
      "version": "1.0.0",
      "dependencies": {
        "hono": "^4.0.0",
      },
    },
    "apps/web/contact-form": {
      "name": "@zipnami/web-contact-form",
      "version": "1.0.0",
    },
    "packages/shared": {
      "name": "@zipnami/shared",
      "version": "1.0.0",
    },
  },
  "packages": {
    "hono": ["hono@4.0.0", "", {}, "sha512-x"],
  }
}
`;

test("each named workspace's version is rewritten, and nothing else", () => {
  const synced = syncLockfileVersions(lockfile, {
    "apps/web/backend": "1.1.0",
    "packages/shared": "1.1.0",
  });

  assert.equal(
    synced,
    lockfile
      .replace(
        `"name": "@zipnami/web-backend",\n      "version": "1.0.0"`,
        `"name": "@zipnami/web-backend",\n      "version": "1.1.0"`,
      )
      .replace(
        `"name": "@zipnami/shared",\n      "version": "1.0.0"`,
        `"name": "@zipnami/shared",\n      "version": "1.1.0"`,
      ),
  );
  // A workspace the release does not version keeps its own.
  assert.match(synced, /"@zipnami\/web-contact-form",\n {6}"version": "1\.0\.0"/);
});

test("a workspace whose version already matches leaves the file unchanged", () => {
  assert.equal(syncLockfileVersions(lockfile, { "packages/shared": "1.0.0" }), lockfile);
});

test("a workspace missing from bun.lock is an error, not a silent skip", () => {
  assert.throws(
    () => syncLockfileVersions(lockfile, { "packages/postal-data": "1.1.0" }),
    /packages\/postal-data/,
  );
});

test("a path is matched as a whole key, not as a prefix of another", () => {
  assert.throws(() => syncLockfileVersions(lockfile, { "apps/web": "1.1.0" }), /apps\/web/);
});

test("Windows line endings are kept", () => {
  const crlf = lockfile.replace(/\n/g, "\r\n");
  const synced = syncLockfileVersions(crlf, { "packages/shared": "2.0.0" });
  assert.match(synced, /"@zipnami\/shared",\r\n {6}"version": "2\.0\.0"/);
  assert.ok(!/[^\r]\n/.test(synced));
});
