import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, test } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./fetch-ken-all.ts", import.meta.url),
);

// spawnSync blocks the runner, so Vitest's testTimeout cannot interrupt a
// hung child; bound the subprocess itself.
const SPAWN_TIMEOUT_MS = 20_000;

/*
 * The acceptance test covers every way a download can be unusable. These
 * cover the command's own edges, which no download reaches: a missing
 * argument, and an output location the command cannot write to after a
 * successful download. A local server stands in for Japan Post.
 */

// "東京都" in Shift-JIS, stored (uncompressed) in a one-entry ZIP.
const archive = (() => {
  const content = Buffer.from([0x93, 0x8c, 0x8b, 0x9e, 0x93, 0x73]);
  const name = Buffer.from("KEN_ALL.CSV", "ascii");
  const data = deflateRawSync(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc32(content), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc32(content), 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, end]);
})();
describe("fetch-ken-all CLI", () => {
  test("exits non-zero with usage when no output path is given", () => {
    const result = spawnSync("bun", ["run", scriptPath], {
      encoding: "utf8",
      timeout: SPAWN_TIMEOUT_MS,
      env: { ...process.env, ZIPNAMI_KEN_ALL_URL: "http://127.0.0.1:9/x.zip" },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Usage:/);
  });

  test(
    "exits non-zero and leaves no partial file when the download succeeds but the output cannot be written",
    { timeout: 60_000 },
    async () => {
      const server = createServer((_request, response) => {
        response.end(archive);
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const { port } = server.address() as AddressInfo;
      const directory = mkdtempSync(path.join(tmpdir(), "zipnami-fetch-"));
      const outputPath = path.join(directory, "missing", "ken-all.csv");

      try {
        // Asynchronous, so the in-process server can answer the child.
        const result = await new Promise<{
          code: number | null;
          stderr: string;
        }>((resolve, reject) => {
          const child = spawn("bun", ["run", scriptPath, outputPath], {
            timeout: SPAWN_TIMEOUT_MS,
            env: {
              ...process.env,
              ZIPNAMI_KEN_ALL_URL: `http://127.0.0.1:${port}/ken_all.zip`,
            },
          });
          const stderr: Buffer[] = [];
          child.stderr.on("data", (chunk: Buffer) => {
            stderr.push(chunk);
          });
          child.on("error", reject);
          child.on("close", (code) => {
            resolve({ code, stderr: Buffer.concat(stderr).toString("utf8") });
          });
        });

        expect(result.code).not.toBe(0);
        // The failure is the write, not the download.
        expect(result.stderr).not.toMatch(/Refusing to write/);
        expect(existsSync(outputPath)).toBe(false);
        expect(readdirSync(directory)).toEqual([]);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
