import { crc32, inflateRawSync } from "node:zlib";

/**
 * Where Japan Post publishes the national KEN_ALL archive (the "読み仮名データの
 * 促音・拗音を小書きで表記するもの" variant, the one `KEN_ALL.CSV` documents
 * describe).
 */
export const KEN_ALL_ZIP_URL =
  "https://www.post.japanpost.jp/service/search/zipcode/download/kogaki/zip/ken_all.zip";

const KEN_ALL_ENTRY_NAME = "KEN_ALL.CSV";

// "PK", the end-of-central-directory signature as it appears in
// the archive's little-endian bytes.
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = Buffer.from([
  0x50, 0x4b, 0x05, 0x06,
]);
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAX_ARCHIVE_COMMENT_SIZE = 0xffff;
const STORED = 0;
const DEFLATED = 8;

// The real KEN_ALL.CSV is about 12 MB. An entry declaring far more is not
// Japan Post's file, and inflating it first would let a hostile or broken
// archive exhaust memory before any check ran.
const MAX_KEN_ALL_CSV_BYTES = 64 * 1024 * 1024;

// The real archive is about 2 MB. The same generous ceiling as the CSV it
// holds: an archive cannot usefully be larger than its uncompressed content.
const MAX_ARCHIVE_BYTES = MAX_KEN_ALL_CSV_BYTES;

// Generous for a ~2 MB archive on a slow line, but finite: a stalled
// download has to end as a failure rather than hang the maintainer's shell.
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** Raised when a download cannot yield a usable KEN_ALL.CSV. */
export class KenAllArchiveError extends Error {
  override name = "KenAllArchiveError";
}

type CentralDirectoryEntry = {
  readonly name: string;
  readonly method: number;
  readonly checksum: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly localHeaderOffset: number;
};

// The end-of-central-directory record sits at the very end of the archive,
// followed only by an optional comment, so it is searched for backwards.
const findEndOfCentralDirectory = (archive: Buffer): number => {
  const earliest = Math.max(
    0,
    archive.length - END_OF_CENTRAL_DIRECTORY_SIZE - MAX_ARCHIVE_COMMENT_SIZE,
  );

  const offset = archive.lastIndexOf(
    END_OF_CENTRAL_DIRECTORY_SIGNATURE,
    archive.length - END_OF_CENTRAL_DIRECTORY_SIZE,
  );

  if (offset < earliest) {
    throw new KenAllArchiveError(
      "not a complete ZIP archive: no end-of-central-directory record " +
        "(the download may be truncated)",
    );
  }

  return offset;
};

// Each central directory record is variable-length, so the next one's
// offset is only known after reading the current one.
const readCentralDirectoryFrom = (
  archive: Buffer,
  offset: number,
  remaining: number,
): CentralDirectoryEntry[] => {
  if (remaining === 0) {
    return [];
  }

  if (
    offset + 46 > archive.length ||
    archive.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE
  ) {
    throw new KenAllArchiveError("corrupt ZIP central directory");
  }

  const nameLength = archive.readUInt16LE(offset + 28);
  const extraLength = archive.readUInt16LE(offset + 30);
  const commentLength = archive.readUInt16LE(offset + 32);
  const entry: CentralDirectoryEntry = {
    name: archive.toString("latin1", offset + 46, offset + 46 + nameLength),
    method: archive.readUInt16LE(offset + 10),
    checksum: archive.readUInt32LE(offset + 16),
    compressedSize: archive.readUInt32LE(offset + 20),
    size: archive.readUInt32LE(offset + 24),
    localHeaderOffset: archive.readUInt32LE(offset + 42),
  };

  return [
    entry,
    ...readCentralDirectoryFrom(
      archive,
      offset + 46 + nameLength + extraLength + commentLength,
      remaining - 1,
    ),
  ];
};

const readCentralDirectory = (archive: Buffer): CentralDirectoryEntry[] => {
  const end = findEndOfCentralDirectory(archive);

  return readCentralDirectoryFrom(
    archive,
    archive.readUInt32LE(end + 16),
    archive.readUInt16LE(end + 10),
  );
};

const decompress = (entry: CentralDirectoryEntry, data: Buffer): Buffer => {
  if (entry.method === STORED) {
    return data;
  }

  if (entry.method !== DEFLATED) {
    throw new KenAllArchiveError(
      `${entry.name} uses unsupported compression method ${entry.method}`,
    );
  }

  try {
    // Stops inflating at the declared size, so data that expands beyond it
    // fails here instead of after it has been held in memory.
    return inflateRawSync(data, { maxOutputLength: entry.size || 1 });
  } catch (cause) {
    throw new KenAllArchiveError(`${entry.name} cannot be inflated`, {
      cause,
    });
  }
};

const readEntry = (
  archive: Buffer,
  entry: CentralDirectoryEntry,
): Uint8Array => {
  const header = entry.localHeaderOffset;

  if (
    header + 30 > archive.length ||
    archive.readUInt32LE(header) !== LOCAL_FILE_HEADER_SIGNATURE
  ) {
    throw new KenAllArchiveError(`corrupt ZIP entry header for ${entry.name}`);
  }

  // The local header repeats the name and may carry a different extra field
  // than the central directory, so the data offset comes from its own
  // lengths.
  const dataStart =
    header +
    30 +
    archive.readUInt16LE(header + 26) +
    archive.readUInt16LE(header + 28);
  const dataEnd = dataStart + entry.compressedSize;

  if (dataEnd > archive.length) {
    throw new KenAllArchiveError(`${entry.name} is truncated`);
  }

  if (entry.size > MAX_KEN_ALL_CSV_BYTES) {
    throw new KenAllArchiveError(
      `${entry.name} declares ${entry.size} bytes, larger than ` +
        `${MAX_KEN_ALL_CSV_BYTES} bytes any KEN_ALL.CSV needs`,
    );
  }

  const content = decompress(entry, archive.subarray(dataStart, dataEnd));

  // The checksum is what turns a silently damaged download into a loud
  // failure: a size match alone would accept corrupted bytes.
  if (content.length !== entry.size || crc32(content) !== entry.checksum) {
    throw new KenAllArchiveError(`${entry.name} failed its integrity check`);
  }

  // A plain view over the same memory: callers get the Uint8Array the
  // signature promises, not a Node Buffer, without copying the file again.
  return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
};

/**
 * Returns the raw bytes of `KEN_ALL.CSV` from a `ken_all.zip` archive.
 *
 * ZIP is read here rather than through a dependency: Node's zlib inflates
 * the DEFLATE data but does not parse the ZIP container, and the subset this
 * archive uses (one entry, stored or deflated, no encryption) is small
 * enough that a dependency would add more supply-chain surface than code.
 */
export const extractKenAllCsv = (archive: Uint8Array): Uint8Array => {
  const buffer = Buffer.from(
    archive.buffer,
    archive.byteOffset,
    archive.byteLength,
  );

  if (buffer.length < END_OF_CENTRAL_DIRECTORY_SIZE) {
    throw new KenAllArchiveError(
      `not a ZIP archive: only ${buffer.length} bytes`,
    );
  }

  const entry = readCentralDirectory(buffer).find(
    (candidate) => candidate.name.toUpperCase() === KEN_ALL_ENTRY_NAME,
  );

  if (entry === undefined) {
    throw new KenAllArchiveError(`the archive has no ${KEN_ALL_ENTRY_NAME}`);
  }

  return readEntry(buffer, entry);
};

/**
 * Decodes Japan Post's Shift-JIS text. `fatal` makes a byte sequence that is
 * not Shift-JIS an error instead of a replacement character that would end up
 * inside an address.
 */
export const decodeShiftJis = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder("shift_jis", { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new KenAllArchiveError(
      `${KEN_ALL_ENTRY_NAME} is not valid Shift-JIS`,
      { cause },
    );
  }
};

const tooLarge = (url: string, limit: number): KenAllArchiveError =>
  new KenAllArchiveError(
    `downloading ${url} returned more than ${limit} bytes, larger than ` +
      "any ken_all.zip needs",
  );

// Reads chunk by chunk and stops as soon as the total passes the limit, so
// an oversized or endless body fails before it is held in memory. The chunk
// list only grows; copying it per read would make a body that arrives in
// many small chunks quadratic.
const readChunksWithin = async (
  body: ReadableStream<Uint8Array>,
  url: string,
  limit: number,
): Promise<Uint8Array[]> => {
  const chunks: Uint8Array[] = [];
  const total = { length: 0 };

  // Leaving the loop early (the throw below) cancels the stream.
  for await (const chunk of body) {
    total.length += chunk.byteLength;

    if (total.length > limit) {
      throw tooLarge(url, limit);
    }

    chunks.push(chunk);
  }

  return chunks;
};

const readBodyWithin = async (
  response: Response,
  url: string,
  limit: number,
): Promise<Uint8Array> => {
  const declared = Number(response.headers.get("Content-Length"));

  if (declared > limit) {
    await response.body?.cancel();
    throw tooLarge(url, limit);
  }

  if (response.body === null) {
    return new Uint8Array();
  }

  return Buffer.concat(await readChunksWithin(response.body, url, limit));
};

/**
 * Downloads `ken_all.zip` and returns its `KEN_ALL.CSV` decoded to UTF-8
 * text, ready for `buildPostalCodeDataset`. Rejects on any HTTP error, empty
 * response, or damaged archive, so a caller never receives partial data.
 */
export const retrieveKenAllCsv = async (
  url: string,
  fetchArchive: typeof fetch = fetch,
  {
    timeoutMs = DOWNLOAD_TIMEOUT_MS,
    maxArchiveBytes = MAX_ARCHIVE_BYTES,
  }: { timeoutMs?: number; maxArchiveBytes?: number } = {},
): Promise<string> => {
  const response = await fetchArchive(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  // The CRC-32 inside the archive detects damage, not substitution, so the
  // transport is the only protection against a tampered file. A redirect that
  // drops https must not quietly remove it.
  if (url.startsWith("https:") && response.url.startsWith("http:")) {
    throw new KenAllArchiveError(
      `downloading ${url} was redirected to ${response.url}, which is not https`,
    );
  }

  if (!response.ok) {
    throw new KenAllArchiveError(
      `downloading ${url} failed with HTTP ${response.status}`,
    );
  }

  const archive = await readBodyWithin(response, url, maxArchiveBytes);

  if (archive.length === 0) {
    throw new KenAllArchiveError(`downloading ${url} returned no data`);
  }

  const text = decodeShiftJis(extractKenAllCsv(archive));

  if (text.trim() === "") {
    throw new KenAllArchiveError(`${KEN_ALL_ENTRY_NAME} is empty`);
  }

  return text;
};
