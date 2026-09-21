# @zipnami/postal-data

Builds the Zipnami postal-code dataset from Japan Post's official postal-code
CSV (`KEN_ALL.CSV`).

## Source

Japan Post publishes the postal-code dataset used here at
<https://www.post.japanpost.jp/zipcode/download.html>. The archive is
distributed as a Shift-JIS CSV named `KEN_ALL.CSV`, thirteen comma-separated
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
bun run --filter @zipnami/postal-data build
```

This runs the package's `build` script (`scripts/build-dataset.ts`), which
reads a KEN_ALL.CSV-shaped file already decoded to UTF-8, builds the dataset
through `buildPostalCodeDataset`, and writes the result as JSON. Pass the
input path (and, optionally, an output path) after `--`:

```sh
bun run build -- <path-to-decoded-ken-all.csv> [output.json]
```

With no output path, the JSON is written to stdout. JSON is a deliberately
plain choice here: how the Worker ultimately loads the artifact, and the
Worker size and loading-failure concerns that should decide its final
format, are not settled by this command. This command is the normalization
step — decoded CSV in, the `PostalCode[]` value out — that any later format
choice would build on.
