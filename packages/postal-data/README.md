# @zipnami/postal-data

Builds the Zipnami postal-code dataset from Japan Post's official postal-code
CSV (`KEN_ALL.CSV`).

## Source

Japan Post publishes the postal-code dataset used here at
<https://www.post.japanpost.jp/service/search/zipcode/download/>, as a ZIP
archive at
<https://www.post.japanpost.jp/service/search/zipcode/download/kogaki/zip/ken_all.zip>.
The archive holds one Shift-JIS CSV named `KEN_ALL.CSV`, fifteen
comma-separated columns per record, quoted text fields. (The older
`/zipcode/dl/kogaki/zip/ken_all.zip` path now answers HTTP 404.)

Retrieval date: **2026-10-16**, by running the procedure below against the
live site. That retrieval yielded 124,840 records, which `regenerate`
turned into 120,720 postal codes and 124,525 addresses. No town name was
left with an unbalanced parenthesis after the split-town reassembly.

The committed data has not been switched to that retrieval yet. The
Worker's artifact still comes from the small hand-built source described
next (shaped on 2026-09-21 like `KEN_ALL.CSV`; see also
`acceptance/fixtures/japan-post-ken-all-excerpt.csv`). Replacing it with
the full dataset is a separate decision, because the artifact's size and
the Worker's limits come with it.

### Retrieving the archive from Japan Post

Retrieval and regeneration are two commands, run from the repository root.
The first writes `KEN_ALL.CSV` decoded to UTF-8; the second is the existing
`regenerate` step, unchanged, reading that file:

```sh
bun run --filter @zipnami/postal-data fetch-ken-all -- data/ken-all.japan-post.csv
bun run --filter @zipnami/postal-data regenerate --   data/ken-all.japan-post.csv <output.json>
```

`fetch-ken-all` (`scripts/fetch-ken-all.ts`, logic in
`src/ken-all-archive.ts`) downloads `ken_all.zip`, extracts `KEN_ALL.CSV`,
checks it against the CRC-32 the archive records, and decodes it with a strict
Shift-JIS decoder. It exits non-zero and writes nothing on a network error, an
HTTP error status, an empty response, a truncated or damaged archive, an
archive without `KEN_ALL.CSV`, or bytes that are not Shift-JIS. It writes to a
temporary file first and renames it into place, so a failed run never replaces
an earlier, complete retrieval.

The ZIP container is read in `src/ken-all-archive.ts` rather than through a
dependency: Node's `zlib` inflates the compressed data but does not parse the
ZIP format, and this archive uses only a small part of it (one entry, stored
or deflated, no encryption).

Japan Post publishes no checksum for `ken_all.zip`, so the CRC-32 check catches
a damaged download but cannot prove the file is the one Japan Post intended.
`ZIPNAMI_KEN_ALL_URL` overrides the download URL. It exists so the
acceptance test can serve an archive locally, and is not part of the
maintainer procedure.

### The committed source for the generated artifact

`apps/web/backend/src/data/postal-codes.generated.json` is the artifact the
Worker imports at runtime. Its source is committed at
`data/ken-all.source.csv`: a small `KEN_ALL.CSV`-shaped file, hand-built the
same way as the test fixture above, covering the same five postal codes the
Worker's artifact holds. Regenerating from it through
`buildPostalCodeDataset` reproduces that artifact's content and order
exactly (design.md §4.3's "the same input must produce the same content and
order").

## Checking the generated artifact for drift

The repository root defines a `check:postal-data` script (see the root
`README.md`'s Commands table for the exact invocation) that runs
`scripts/check-dataset.ts` from here against `data/ken-all.source.csv` and
the Worker's committed artifact. It **compares without overwriting**: it
regenerates the dataset from the source in memory, parses the committed
artifact's JSON, and reports a mismatch — it never writes to the artifact
file, so a drifted artifact is never silently "fixed" by the check itself.
Comparison is by parsed content (`src/check-dataset.ts`'s `jsonDeepEqual`),
not by exact bytes: array order is significant, but object key order is
not, since the committed artifact is hand-formatted and need not match the
generator's key order byte-for-byte. Exit code 0 means the artifact
matches; non-zero means it has drifted from what `data/ken-all.source.csv`
regenerates. It runs on every pull request (see
`.github/workflows/ci-pull-request.yml`'s `Static checks` job).

### Updating the dataset

When the source postal-code data changes: update `data/ken-all.source.csv`
(or replace it with a fresh `KEN_ALL.CSV` download, decoded to UTF-8),
regenerate the artifact, and commit both together so the drift check above
keeps passing:

```sh
bun run --filter @zipnami/postal-data regenerate -- \
  data/ken-all.source.csv \
  ../../apps/web/backend/src/data/postal-codes.generated.json
```

## What this package does

`buildPostalCodeDataset(source)` (`src/index.ts`) turns KEN_ALL.CSV-shaped
text into an array of `PostalCode` values (see `@zipnami/shared`):

- records are grouped by their seven-digit postal code, leading zeroes kept;
- each address comes from the prefecture, city, and town **kanji** columns,
  never the kana reading columns;
- two records under the same postal code deduplicate into one address only
  when prefecture, city, and town are all identical; distinct tuples are
  all retained, in first-appearance order; and
- running the build twice against the same input produces byte-identical
  output.

### Reassembling town names split across records

`KEN_ALL.CSV` splits a town entry too long for one record (a kanji town
name over 38 full-width characters, or a reading over 76 half-width
characters) across two or more consecutive records that share the postal code,
prefecture, and city. None of its flag columns marks such a continuation,
so the build reassembles them by the convention other `KEN_ALL.CSV`
parsers use: a town field with more full-width opening parentheses `（`
than closing ones `）` continues in the next record. The town text of
following records is appended until the parentheses balance, and the
result becomes one address before grouping and deduplication. For
example, `葛巻（第４０地割「…」～第４５` followed by `地割）` becomes
`葛巻（第４０地割「…」～第４５地割）`.

A record whose parentheses already balance is never merged with its
neighbor. Nor is a record merged into a following record with a
different postal code, prefecture, or city, even if its `（` is never
closed: joining across those boundaries would invent an address that
Japan Post never published, so the unclosed fragment is kept as it is.

## Regenerating the dataset

```sh
bun run --filter @zipnami/postal-data regenerate -- <path-to-decoded-ken-all.csv> [output.json]
```

This runs the package's `regenerate` script (`scripts/build-dataset.ts`)
with this package's own directory (`packages/postal-data/`) as the working
directory, not the repo root — `--filter <pkg> <script>` always runs a
workspace's script from that workspace's own directory, so both path
arguments above are resolved relative to `packages/postal-data/`, not the
repository root (confirmed by running the command with each path style).
It reads a KEN_ALL.CSV-shaped file already decoded to UTF-8, builds the
dataset through `buildPostalCodeDataset`, and writes the result as JSON.

With no output path, the JSON is written to stdout. JSON is a deliberately
plain choice here: how the Worker ultimately loads the artifact, and the
Worker size and loading-failure concerns that should decide its final
format, are not settled by this command. This command is the normalization
step — decoded CSV in, the `PostalCode[]` value out — that any later format
choice would build on.
