import { crc32, deflateRawSync } from "node:zlib";

/*
 * Builders for a `ken_all.zip`-shaped archive, for the Issue #34 acceptance
 * test.
 *
 * The archive is built in memory rather than committed: this repository
 * normalizes every checked-in text file to LF and UTF-8 (.gitattributes), so
 * a committed Shift-JIS CSV could not carry its original bytes honestly, and
 * a committed binary ZIP would hide its content from review. Building it here
 * keeps every byte the test serves visible in source.
 */

/**
 * Encodes text as Shift-JIS. The runtime ships a Shift-JIS decoder but no
 * encoder, so the encoding table is derived by decoding every two-byte
 * Shift-JIS code once. Using the same decoder the implementation is expected
 * to use is deliberate: the test pins that the bytes Japan Post publishes
 * come back as the original text, not which table either side uses.
 */
const shiftJisTable = (() => {
  const decoder = new TextDecoder("shift_jis", { fatal: true });
  const table = new Map<string, number[]>();

  for (let lead = 0x81; lead <= 0xfc; lead += 1) {
    for (let trail = 0x40; trail <= 0xfc; trail += 1) {
      try {
        const character = decoder.decode(new Uint8Array([lead, trail]));

        if (!table.has(character)) {
          table.set(character, [lead, trail]);
        }
      } catch {
        // Not a valid two-byte code; nothing to record.
      }
    }
  }

  return table;
})();

export const encodeShiftJis = (text: string): Uint8Array => {
  const bytes: number[] = [];

  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;

    if (code < 0x80) {
      bytes.push(code);
      continue;
    }

    // Half-width katakana are single bytes in Shift-JIS.
    if (code >= 0xff61 && code <= 0xff9f) {
      bytes.push(code - 0xff61 + 0xa1);
      continue;
    }

    const encoded = shiftJisTable.get(character);

    if (encoded === undefined) {
      throw new Error(`no Shift-JIS encoding for ${character}`);
    }

    bytes.push(...encoded);
  }

  return Uint8Array.from(bytes);
};

/**
 * A single-entry ZIP archive whose entry is DEFLATE-compressed, the way
 * Japan Post's `ken_all.zip` stores `KEN_ALL.CSV`. Only the fields a reader
 * needs are filled in; timestamps are zero so the bytes are deterministic.
 */
export const zipArchive = (entryName: string, content: Uint8Array): Buffer => {
  const name = Buffer.from(entryName, "ascii");
  const compressed = deflateRawSync(content);
  const checksum = crc32(content);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(name.length, 26);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(8, 10);
  centralHeader.writeUInt32LE(checksum, 16);
  centralHeader.writeUInt32LE(compressed.length, 20);
  centralHeader.writeUInt32LE(content.length, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  centralHeader.writeUInt32LE(0, 42);

  const centralDirectoryOffset =
    localHeader.length + name.length + compressed.length;
  const centralDirectorySize = centralHeader.length + name.length;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralDirectorySize, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);

  return Buffer.concat([
    localHeader,
    name,
    compressed,
    centralHeader,
    name,
    end,
  ]);
};
