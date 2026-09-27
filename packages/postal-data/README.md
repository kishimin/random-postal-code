# @zipnami/postal-data

Builds the Zipnami postal-code dataset from Japan Post's official postal-code
CSV (`KEN_ALL.CSV`).

## Source

Japan Post publishes the postal-code dataset used here at
<https://www.post.japanpost.jp/zipcode/download.html>. The archive is
distributed as a Shift-JIS CSV named `KEN_ALL.CSV`, fifteen comma-separated
columns per record, quoted text fields.

Retrieval date: **2026-09-21**.

That date is honest about what "retrieval" means at this stage of the
project: this package's tests run against a small hand-built fixture shaped
like `KEN_ALL.CSV`
(`acceptance/fixtures/japan-post-ken-all-excerpt.csv`), not a real download
of the archive. Fetching the live file from Japan Post and decoding it from
Shift-JIS to UTF-8 is a separate, later concern — `buildPostalCodeDataset`
takes already-decoded UTF-8 source text, so whoever performs that fetch and
decode step only needs to hand this package the result.

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
