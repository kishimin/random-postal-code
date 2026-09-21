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
  const finalState = [...line].reduce<CsvLineSplitState>((state, character) => {
    if (character === '"') {
      return { ...state, inQuotes: !state.inQuotes };
    }
    if (character === "," && !state.inQuotes) {
      return closeField(state);
    }
    return { ...state, current: state.current + character };
  }, { fields: [], current: "", inQuotes: false });

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

/**
 * Builds the Zipnami postal-code dataset from Japan Post's KEN_ALL.CSV-shaped
 * text, already decoded to UTF-8. Groups records by their seven-digit postal
 * code and collects the address each record contributes under it.
 *
 * The contract is async because the eventual data-pipeline caller treats
 * dataset construction as an I/O-adjacent step, but today's parsing is
 * synchronous throughout; wrapping the result in `Promise.resolve` keeps the
 * signature honest without an `async` function body that has no `await` in
 * it.
 */
export const buildPostalCodeDataset = (
  source: string,
): Promise<PostalCode[]> => {
  const addressesByPostalCode = new Map<string, Address[]>();

  for (const line of source.split(/\r\n|\n/)) {
    if (line.trim() === "") {
      continue;
    }

    const { postalCode, address } = parseRecord(line);
    const addresses = addressesByPostalCode.get(postalCode);

    if (addresses === undefined) {
      addressesByPostalCode.set(postalCode, [address]);
    } else {
      addresses.push(address);
    }
  }

  const dataset = Array.from(
    addressesByPostalCode,
    ([postalCode, addresses]) => ({
      postalCode,
      // Every group is created from one pushed address, so it is never
      // empty; PostalCode's tuple type requires that non-emptiness
      // statically, which a plain Address[] built by this loop cannot
      // express on its own.
      addresses: addresses as [Address, ...Address[]],
    }),
  );

  return Promise.resolve(dataset);
};
