import type { Address, PostalCode } from "@zipnami/shared";

// KEN_ALL.CSV column positions (zero-indexed) this build reads. The reading
// columns between TOWN_KANA and the prefecture column are intentionally
// never referenced: an Address is built from the kanji columns only.
const POSTAL_CODE_COLUMN = 2;
const PREFECTURE_COLUMN = 6;
const CITY_COLUMN = 7;
const TOWN_COLUMN = 8;

type CsvLineSplitState = {
  readonly fields: readonly string[];
  readonly current: string;
  readonly inQuotes: boolean;
};

const closeField = (state: CsvLineSplitState): CsvLineSplitState => ({
  fields: [...state.fields, state.current],
  current: "",
  inQuotes: state.inQuotes,
});

// KEN_ALL.CSV never places a literal double quote inside a field, so unlike
// general-purpose CSV this does not need to handle a doubled `""` escape.
const splitCsvLine = (line: string): string[] => {
  const finalState = [...line].reduce<CsvLineSplitState>(
    (state, character) => {
      if (character === '"') {
        return { ...state, inQuotes: !state.inQuotes };
      }
      if (character === "," && !state.inQuotes) {
        return closeField(state);
      }
      return { ...state, current: state.current + character };
    },
    { fields: [], current: "", inQuotes: false },
  );

  return [...finalState.fields, finalState.current];
};

type ParsedRecord = { postalCode: string; address: Address };

const parseRecord = (line: string): ParsedRecord => {
  const fields = splitCsvLine(line);

  return {
    postalCode: fields[POSTAL_CODE_COLUMN],
    address: {
      prefecture: fields[PREFECTURE_COLUMN],
      city: fields[CITY_COLUMN],
      town: fields[TOWN_COLUMN],
    },
  };
};

const parseRecords = (source: string): ParsedRecord[] =>
  source
    .split(/\r\n|\n/)
    .filter((line) => line.trim() !== "")
    .map(parseRecord);

// Two records are the same address only when prefecture, city, and town all
// match; JSON.stringify of the tuple gives each distinct combination a
// distinct key without picking a delimiter that real address text could
// coincidentally contain.
const addressDedupeKey = (address: Address): string =>
  JSON.stringify([address.prefecture, address.city, address.town]);

// A Map of Maps keyed first by postal code, then by each address's dedupe
// key. The inner Map both deduplicates (re-setting an existing key keeps its
// original position) and preserves first-appearance order, so no separate
// sort or seen-set is needed for either concern.
const groupAddressesByPostalCode = (
  records: readonly ParsedRecord[],
): Map<string, Map<string, Address>> => {
  const addressGroupsByPostalCode = new Map<string, Map<string, Address>>();

  for (const { postalCode, address } of records) {
    const addressGroup =
      addressGroupsByPostalCode.get(postalCode) ?? new Map<string, Address>();

    addressGroup.set(addressDedupeKey(address), address);
    addressGroupsByPostalCode.set(postalCode, addressGroup);
  }

  return addressGroupsByPostalCode;
};

const toDataset = (
  addressGroupsByPostalCode: ReadonlyMap<string, Map<string, Address>>,
): PostalCode[] =>
  Array.from(addressGroupsByPostalCode, ([postalCode, addressGroup]) => ({
    postalCode,
    // Every group is created from one set address, so it is never empty;
    // PostalCode's tuple type requires that non-emptiness statically, which
    // a plain Address[] built from a Map's values cannot express on its own.
    addresses: [...addressGroup.values()] as [Address, ...Address[]],
  }));

/* eslint-disable @typescript-eslint/require-await -- the `async` keyword itself is what converts a synchronous throw into a rejection; that guarantee does not depend on the body containing an `await`. */
/**
 * Builds the Zipnami postal-code dataset from Japan Post's KEN_ALL.CSV-shaped
 * text, already decoded to UTF-8: converts each record, groups the results by
 * their seven-digit postal code, and deduplicates each group's addresses.
 *
 * The function is `async` despite having no `await` in its body: the
 * contract is a Promise, so an idiomatic `buildPostalCodeDataset(source)
 * .catch(handleError)` must have `handleError` invoked for any internal
 * failure. Only an `async` function body turns a synchronous throw into a
 * rejection; a plain function returning `Promise.resolve(...)` would still
 * throw synchronously, past the point where `.catch()` could observe it.
 */
export const buildPostalCodeDataset = async (
  source: string,
): Promise<PostalCode[]> =>
  toDataset(groupAddressesByPostalCode(parseRecords(source)));
/* eslint-enable @typescript-eslint/require-await -- scoped to this one intentionally await-less async function */
