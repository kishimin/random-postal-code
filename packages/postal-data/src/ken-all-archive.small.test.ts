import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import {
  KenAllArchiveError,
  decodeShiftJis,
  extractKenAllCsv,
  retrieveKenAllCsv,
} from "./ken-all-archive.ts";

// "東京都" in Shift-JIS, written as bytes because the runtime has no
// Shift-JIS encoder.
const TOKYO_SHIFT_JIS = Uint8Array.from([0x93, 0x8c, 0x8b, 0x9e, 0x93, 0x73]);

type ZipEntryOptions = {
  method?: number;
  checksum?: number;
};

/**
 * A minimal single-entry ZIP, built inline rather than importing the locked
 * acceptance fixture, with knobs to produce each kind of damage the reader
 * must refuse.
 */
const zip = (
  name: string,
  content: Uint8Array,
  { method = 8, checksum = crc32(content) }: ZipEntryOptions = {},
): Buffer => {
  const nameBytes = Buffer.from(name, "ascii");
  const data = method === 8 ? deflateRawSync(content) : Buffer.from(content);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(local.length + nameBytes.length + data.length, 16);

  return Buffer.concat([local, nameBytes, data, central, nameBytes, end]);
};

const responding =
  (response: Response): typeof fetch =>
  () =>
    Promise.resolve(response);

describe("extractKenAllCsv", () => {
  test("returns the inflated bytes of a deflated KEN_ALL.CSV entry", () => {
    expect(extractKenAllCsv(zip("KEN_ALL.CSV", TOKYO_SHIFT_JIS))).toEqual(
      TOKYO_SHIFT_JIS,
    );
  });

  test("returns the bytes of a stored (uncompressed) entry as they are", () => {
    expect(
      extractKenAllCsv(zip("KEN_ALL.CSV", TOKYO_SHIFT_JIS, { method: 0 })),
    ).toEqual(TOKYO_SHIFT_JIS);
  });

  test("matches the entry name regardless of case", () => {
    expect(extractKenAllCsv(zip("ken_all.csv", TOKYO_SHIFT_JIS))).toEqual(
      TOKYO_SHIFT_JIS,
    );
  });

  test("refuses an archive that has no KEN_ALL.CSV entry", () => {
    expect(() => extractKenAllCsv(zip("OTHER.CSV", TOKYO_SHIFT_JIS))).toThrow(
      /no KEN_ALL\.CSV/,
    );
  });

  test("refuses bytes too short to be an archive", () => {
    expect(() => extractKenAllCsv(Uint8Array.from([1, 2, 3]))).toThrow(
      KenAllArchiveError,
    );
  });

  test("refuses an archive cut off before its central directory", () => {
    const archive = zip("KEN_ALL.CSV", TOKYO_SHIFT_JIS);

    expect(() =>
      extractKenAllCsv(archive.subarray(0, archive.length - 30)),
    ).toThrow(/truncated/);
  });

  test("refuses an entry whose checksum does not match its content", () => {
    expect(() =>
      extractKenAllCsv(zip("KEN_ALL.CSV", TOKYO_SHIFT_JIS, { checksum: 1 })),
    ).toThrow(/integrity/);
  });

  test("refuses an entry compressed with a method it cannot read", () => {
    expect(() =>
      extractKenAllCsv(zip("KEN_ALL.CSV", TOKYO_SHIFT_JIS, { method: 12 })),
    ).toThrow(/unsupported compression method 12/);
  });
});

describe("extractKenAllCsv on damaged archives", () => {
  // Offsets within the archive `zip` builds: a 30-byte local header and the
  // 11-byte name precede the data, and the end record is the last 22 bytes.
  const LOCAL_HEADER = 0;
  const DATA = 30 + "KEN_ALL.CSV".length;

  const damaged = (damage: (archive: Buffer) => void): Buffer => {
    const archive = zip("KEN_ALL.CSV", TOKYO_SHIFT_JIS);

    damage(archive);

    return archive;
  };

  test("refuses an archive whose central directory is not where the end record says", () => {
    const archive = damaged((bytes) => {
      bytes.writeUInt32LE(0, bytes.length - 22 + 16);
    });

    expect(() => extractKenAllCsv(archive)).toThrow(/central directory/);
  });

  test("refuses an entry whose local header is damaged", () => {
    const archive = damaged((bytes) => {
      bytes.writeUInt32LE(0, LOCAL_HEADER);
    });

    expect(() => extractKenAllCsv(archive)).toThrow(/entry header/);
  });

  test("refuses an entry whose data runs past the end of the archive", () => {
    const archive = damaged((bytes) => {
      const central = bytes.readUInt32LE(bytes.length - 22 + 16);

      bytes.writeUInt32LE(0xffffff, central + 20);
    });

    expect(() => extractKenAllCsv(archive)).toThrow(/truncated/);
  });

  test("refuses an entry that declares more content than any KEN_ALL.CSV could hold, before inflating it", () => {
    const archive = damaged((bytes) => {
      const central = bytes.readUInt32LE(bytes.length - 22 + 16);

      bytes.writeUInt32LE(0xffffffff, central + 24);
    });

    expect(() => extractKenAllCsv(archive)).toThrow(/larger than/);
  });

  test("refuses deflated data that inflates past the size the entry declares", () => {
    const content = new Uint8Array(4096);
    const archive = zip("KEN_ALL.CSV", content);
    const central = archive.readUInt32LE(archive.length - 22 + 16);

    // Declares 16 bytes; the data inflates to 4096. Only inflation that
    // stops at the declared size fails this way; inflating everything and
    // comparing afterwards fails the integrity check instead.
    archive.writeUInt32LE(16, central + 24);

    expect(() => extractKenAllCsv(archive)).toThrow(/cannot be inflated/);
  });

  test("refuses deflated data that cannot be inflated", () => {
    const archive = damaged((bytes) => {
      bytes.fill(0xff, DATA, DATA + 2);
    });

    expect(() => extractKenAllCsv(archive)).toThrow(/cannot be inflated/);
  });
});

describe("decodeShiftJis", () => {
  test("decodes Shift-JIS bytes to text", () => {
    expect(decodeShiftJis(TOKYO_SHIFT_JIS)).toBe("東京都");
  });

  test("refuses bytes that are not Shift-JIS instead of inserting replacement characters", () => {
    expect(() => decodeShiftJis(Uint8Array.from([0x81]))).toThrow(
      /not valid Shift-JIS/,
    );
  });
});

describe("retrieveKenAllCsv", () => {
  test("downloads the archive and returns KEN_ALL.CSV decoded to text", async () => {
    const fetchArchive = responding(
      new Response(zip("KEN_ALL.CSV", TOKYO_SHIFT_JIS)),
    );

    await expect(
      retrieveKenAllCsv("https://example.test/ken_all.zip", fetchArchive),
    ).resolves.toBe("東京都");
  });

  test("rejects with the HTTP status when the download fails", async () => {
    const fetchArchive = responding(new Response("busy", { status: 503 }));

    await expect(
      retrieveKenAllCsv("https://example.test/ken_all.zip", fetchArchive),
    ).rejects.toThrow(/HTTP 503/);
  });

  test("rejects an empty response", async () => {
    const fetchArchive = responding(new Response(new Uint8Array()));

    await expect(
      retrieveKenAllCsv("https://example.test/ken_all.zip", fetchArchive),
    ).rejects.toThrow(/no data/);
  });

  test("rejects an archive whose KEN_ALL.CSV is blank", async () => {
    const fetchArchive = responding(
      new Response(zip("KEN_ALL.CSV", Uint8Array.from([0x0d, 0x0a]))),
    );

    await expect(
      retrieveKenAllCsv("https://example.test/ken_all.zip", fetchArchive),
    ).rejects.toThrow(/empty/);
  });

  test("gives up on a download that does not finish within the time limit", async () => {
    // Never answers on its own; settles only when the signal aborts.
    const stalled: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("download aborted", { cause: init.signal?.reason }));
        });
      });

    await expect(
      retrieveKenAllCsv("https://example.test/ken_all.zip", stalled, {
        timeoutMs: 10,
      }),
    ).rejects.toThrow(/timed out|abort/i);
  });

  test("rejects an archive whose KEN_ALL.CSV is not Shift-JIS", async () => {
    const fetchArchive = responding(
      new Response(zip("KEN_ALL.CSV", Uint8Array.from([0x81]))),
    );

    await expect(
      retrieveKenAllCsv("https://example.test/ken_all.zip", fetchArchive),
    ).rejects.toThrow(/not valid Shift-JIS/);
  });

  test("rejects an https download that a redirect moved to plain http", async () => {
    const redirected = new Response(zip("KEN_ALL.CSV", TOKYO_SHIFT_JIS));

    Object.defineProperty(redirected, "url", {
      value: "http://example.test/ken_all.zip",
    });

    await expect(
      retrieveKenAllCsv(
        "https://example.test/ken_all.zip",
        responding(redirected),
      ),
    ).rejects.toThrow(/http:/);
  });

  test("rejects a response that declares a body larger than the limit without reading it", async () => {
    const reads = { count: 0 };
    // highWaterMark 0: the stream does not pull until someone reads, so the
    // count shows whether the body was read at all.
    const body = new ReadableStream<Uint8Array>(
      {
        pull: (controller) => {
          reads.count += 1;
          controller.enqueue(new Uint8Array(64));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const fetchArchive = responding(
      new Response(body, { headers: { "Content-Length": "1000" } }),
    );

    await expect(
      retrieveKenAllCsv("https://example.test/ken_all.zip", fetchArchive, {
        maxArchiveBytes: 100,
      }),
    ).rejects.toThrow(/larger than/);
    expect(reads.count).toBe(0);
  });

  test("stops reading a response body once it passes the limit, even without a declared length", async () => {
    const served = { chunks: 0 };
    const endless = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        served.chunks += 1;
        controller.enqueue(new Uint8Array(64));
      },
    });
    const fetchArchive = responding(new Response(endless));

    await expect(
      retrieveKenAllCsv("https://example.test/ken_all.zip", fetchArchive, {
        maxArchiveBytes: 100,
      }),
    ).rejects.toThrow(/larger than/);
    expect(served.chunks).toBeLessThan(10);
  });

  test("passes a network failure through as a rejection", async () => {
    const failure = new TypeError("fetch failed");
    const fetchArchive: typeof fetch = () => Promise.reject(failure);

    await expect(
      retrieveKenAllCsv("https://example.test/ken_all.zip", fetchArchive),
    ).rejects.toBe(failure);
  });
});
