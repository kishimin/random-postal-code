import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import path from "node:path";
import { Linking, Platform } from "react-native";

/*
 * Acceptance test for Issue #14: the mobile app keeps its recent history on
 * the device and opens each address in an external map, on Android and iOS.
 *
 * Each test name starts with the criterion it holds (AC-1 … AC-9, in the
 * Issue's order). AC-7 (no map SDK or location permission) and AC-10
 * (`expo export --platform ios`) are about what is built and live in
 * mobile-generation-history-bundle.medium.test.ts, which also checks that
 * this file runs under both platform projects (AC-9).
 *
 * How the app is exercised
 * ------------------------
 * As in Issue #13's screen test, the app's own route directory is rendered
 * through Expo Router's testing library, once with the jest-expo iOS preset
 * and once with the Android preset (ADR-0082). `fetch` answers like the Hono
 * `GET /api/random` contract.
 *
 * Device storage is `@react-native-async-storage/async-storage`, the owner's
 * choice on Issue #14 (2026-11-17), replaced by the Jest mock the library
 * ships. It keeps what is written in memory for the whole test file, so a
 * restart is an unmount followed by a fresh render of the routes. Clearing
 * the storage stands for a device whose storage holds nothing: after it, a
 * restart must show no history, which tells history that lives on the
 * device apart from history that only lives in the running JavaScript.
 *
 * Opening a map goes through React Native's `Linking`, which `expo-linking`
 * calls. Its `openURL` and `canOpenURL` are replaced; a device without a
 * map handler is one where `canOpenURL` answers false or `openURL` rejects
 * (Android rejects when no activity handles the intent). Both are set in
 * the failure tests, so the app may check first or just try.
 *
 * What users see
 * --------------
 * History is the area labelled 「生成の履歴」 under the heading of the same
 * name (Issue #13 placed it). Its entries show their postal codes as
 * 「〒123-4567」, newest first, and every stored address. The current result
 * is also the newest history entry, as on the Web (docs/design.md 6.1).
 *
 * Every address, in the current result and in each history entry, has a
 * link named 「<address>をGoogle マップで開く」, the Web's name for the same
 * action. It opens a Google Maps search URL whose `query` names the address
 * percent-encoded, the Web's precedent (apps/web/frontend map links).
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - The storage key and the stored format. Persistence is shown by a
 *   restart, not by reading the storage.
 * - The copy of the map failure report. It must be an alert (the role
 *   TalkBack and VoiceOver announce), not a particular sentence.
 * - That an installed map app really opens. No device runs in CI, and
 *   design.md section 6.3 rules out an iOS device check.
 * - Embedded maps and cross-device history (Out of scope).
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  // jest.mock factories are hoisted above the imports, so they require.
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const apiBaseUrl = "https://api.zipnami-acceptance.example";
process.env.EXPO_PUBLIC_API_BASE_URL = apiBaseUrl;

const appDirectory = path.resolve(
  __dirname,
  "..",
  "apps",
  "mobile",
  "src",
  "app",
);

const startLabel = "ランダム生成する";
const regenerateLabel = "もう一度、波に乗る";
const retryLabel = "再試行する";
const currentResultLabel = "今回の結果";
const historyLabel = "生成の履歴";
const historyLimit = 20;

type Address = { prefecture: string; city: string; town: string };
type Result = { postalCode: string; addresses: Address[] };

const tokyo: Result = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

// A real postal code that Japan Post assigns to more than one town.
const sapporo: Result = {
  postalCode: "0600000",
  addresses: [
    {
      prefecture: "北海道",
      city: "札幌市中央区",
      town: "以下に掲載がない場合",
    },
    { prefecture: "北海道", city: "札幌市中央区", town: "大通西" },
  ],
};

const osaka: Result = {
  postalCode: "5300001",
  addresses: [{ prefecture: "大阪府", city: "大阪市北区", town: "梅田" }],
};

/**
 * A distinct result per index, for filling the history past its limit.
 * @param index - 1 to 21.
 * @returns A result whose postal code and town carry the index.
 */
const numbered = (index: number): Result => ({
  postalCode: `90000${String(index).padStart(2, "0")}`,
  addresses: [
    {
      prefecture: "沖縄県",
      city: "那覇市",
      town: `テスト町${String(index)}`,
    },
  ],
});

const fullAddress = (address: Address): string =>
  `${address.prefecture}${address.city}${address.town}`;

const displayed = (result: Result): string =>
  `〒${result.postalCode.slice(0, 3)}-${result.postalCode.slice(3)}`;

const mapLinkName = (address: Address): string =>
  `${fullAddress(address)}をGoogle マップで開く`;

const respond = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * React Native's fetch rejects this way when there is no connection.
 * @returns The rejection.
 */
const offline = (): Error => new TypeError("Network request failed");

/**
 * A fetch that answers each call with the next queued outcome.
 * @param outcomes - Responses to resolve with, or errors to reject with.
 * @returns The installed mock.
 */
const queueFetch = (
  ...outcomes: Array<Response | Error>
): jest.Mock<typeof fetch> => {
  const mock = jest.fn<typeof fetch>();
  for (const outcome of outcomes) {
    mock.mockImplementationOnce(() =>
      outcome instanceof Error
        ? Promise.reject(outcome)
        : Promise.resolve(outcome),
    );
  }
  globalThis.fetch = mock;
  return mock;
};

const currentResult = () => within(screen.getByLabelText(currentResultLabel));
const history = () => within(screen.getByLabelText(historyLabel));

/**
 * The postal codes the history shows, top to bottom.
 * @returns Displayed postal codes such as 〒100-0001.
 */
const historyCodes = (): string[] =>
  history()
    .queryAllByText(/^〒\d{3}-\d{4}$/)
    .map((element) => {
      const children: unknown = element.props.children;
      return Array.isArray(children) ? children.join("") : String(children);
    });

const expectCurrent = async (result: Result): Promise<void> => {
  await waitFor(() => {
    expect(currentResult().getByText(displayed(result))).toBeTruthy();
  });
};

/** Lets pending promise callbacks, such as a storage read or write, run. */
const settle = async (): Promise<void> => {
  // Timers are not used to wait: Expo Router's testing library may install
  // fake ones, and a timer would never fire.
  await act(async () => {
    for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
  });
};

/**
 * Presses the generate action and waits for the result to be shown.
 * @param result - The result the queued fetch answers with.
 */
const generate = async (result: Result): Promise<void> => {
  const name =
    screen.queryByRole("button", { name: startLabel }) === null
      ? regenerateLabel
      : startLabel;
  await fireEvent.press(screen.getByRole("button", { name }));
  await expectCurrent(result);
};

/** Unmounts the app and starts it again, as a person reopening it does. */
const restart = async (): Promise<void> => {
  await settle();
  await screen.unmount();
  await renderRouter(appDirectory, { initialUrl: "/" });
};

/**
 * What presses on map links handed to the operating system.
 * @returns The URLs, in the order they were opened.
 */
const openedUrls = (): string[] =>
  jest.mocked(Linking.openURL).mock.calls.map(([url]) => String(url));

const expectMapUrlFor = (url: string, address: Address): void => {
  const parsed = new URL(url);
  expect(`${parsed.origin}${parsed.pathname}`).toBe(
    "https://www.google.com/maps/search/",
  );
  const query = parsed.searchParams.get("query") ?? "";
  expect(query).toContain(address.prefecture);
  expect(query).toContain(address.city);
  expect(query).toContain(address.town);
  // Encoded: the address text never appears in the URL as written.
  expect(url).not.toContain(address.prefecture);
  expect(url).not.toContain(address.town);
};

const expectNoServerSync = (fetchMock: jest.Mock<typeof fetch>): void => {
  for (const [input, init] of fetchMock.mock.calls) {
    const url = new URL(String(input instanceof Request ? input.url : input));
    expect(`${url.origin}${url.pathname}`).toBe(`${apiBaseUrl}/api/random`);
    const method =
      input instanceof Request ? input.method : (init?.method ?? "GET");
    expect(method.toUpperCase()).toBe("GET");
    expect(init?.body ?? undefined).toBeUndefined();
  }
};

const originalFetch = globalThis.fetch;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  await renderRouter(appDirectory, { initialUrl: "/" });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe(`Issue #14 on ${Platform.OS}: mobile history and external map links`, () => {
  test("AC-9 runs as the iOS or the Android platform, not as Web", () => {
    expect(["ios", "android"]).toContain(Platform.OS);
  });

  test("AC-1 each successful result is inserted at the beginning of the history", async () => {
    queueFetch(respond(200, tokyo), respond(200, sapporo), respond(200, osaka));

    await generate(tokyo);
    await waitFor(() => {
      expect(historyCodes()).toEqual([displayed(tokyo)]);
    });
    await generate(sapporo);
    await generate(osaka);

    await waitFor(() => {
      expect(historyCodes()).toEqual([
        displayed(osaka),
        displayed(sapporo),
        displayed(tokyo),
      ]);
    });
  });

  test("AC-1 a failed generation adds nothing to the history", async () => {
    queueFetch(respond(200, tokyo), offline(), respond(200, sapporo));

    await generate(tokyo);
    await fireEvent.press(
      screen.getByRole("button", { name: regenerateLabel }),
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    expect(historyCodes()).toEqual([displayed(tokyo)]);

    await fireEvent.press(screen.getByRole("button", { name: retryLabel }));
    await expectCurrent(sapporo);
    await waitFor(() => {
      expect(historyCodes()).toEqual([displayed(sapporo), displayed(tokyo)]);
    });
  });

  test("AC-2 the history keeps at most 20 entries and drops the oldest", async () => {
    const results = Array.from({ length: historyLimit + 1 }, (_, index) =>
      numbered(index + 1),
    );
    queueFetch(...results.map((result) => respond(200, result)));

    for (const result of results.slice(0, historyLimit)) {
      await generate(result);
    }
    await waitFor(() => {
      expect(historyCodes()).toHaveLength(historyLimit);
    });

    const [oldest] = results;
    const newest = results[historyLimit];
    if (oldest === undefined || newest === undefined) {
      throw new Error("expected 21 results");
    }
    await generate(newest);

    const newestFirst = [...results].reverse().map(displayed);
    await waitFor(() => {
      expect(historyCodes()).toEqual(newestFirst.slice(0, historyLimit));
    });
    expect(historyCodes()).not.toContain(displayed(oldest));
  });

  test("AC-3 a repeated postal code stays a separate entry in chronological order", async () => {
    queueFetch(respond(200, tokyo), respond(200, sapporo), respond(200, tokyo));

    await generate(tokyo);
    await generate(sapporo);
    await generate(tokyo);

    await waitFor(() => {
      expect(historyCodes()).toEqual([
        displayed(tokyo),
        displayed(sapporo),
        displayed(tokyo),
      ]);
    });
  });

  test("AC-4 a history entry shows every address of its postal code", async () => {
    queueFetch(respond(200, sapporo), respond(200, tokyo));

    await generate(sapporo);
    await generate(tokyo);

    await waitFor(() => {
      expect(historyCodes()).toEqual([displayed(tokyo), displayed(sapporo)]);
    });
    for (const address of [...sapporo.addresses, ...tokyo.addresses]) {
      expect(history().getByText(fullAddress(address))).toBeTruthy();
    }
  });

  test("AC-1 AC-3 AC-4 the history is still there, in order with every address, after the app restarts", async () => {
    queueFetch(respond(200, tokyo), respond(200, sapporo), respond(200, tokyo));

    await generate(tokyo);
    await generate(sapporo);
    await generate(tokyo);
    await waitFor(() => {
      expect(historyCodes()).toHaveLength(3);
    });

    await restart();

    await waitFor(() => {
      expect(historyCodes()).toEqual([
        displayed(tokyo),
        displayed(sapporo),
        displayed(tokyo),
      ]);
    });
    for (const address of sapporo.addresses) {
      expect(history().getByText(fullAddress(address))).toBeTruthy();
    }
  });

  test("AC-2 the limit of 20 holds across a restart", async () => {
    const results = Array.from({ length: historyLimit + 1 }, (_, index) =>
      numbered(index + 1),
    );
    queueFetch(...results.map((result) => respond(200, result)));

    for (const result of results) {
      await generate(result);
    }
    await waitFor(() => {
      expect(historyCodes()).toHaveLength(historyLimit);
    });

    await restart();

    const newestFirst = [...results].reverse().map(displayed);
    await waitFor(() => {
      expect(historyCodes()).toEqual(newestFirst.slice(0, historyLimit));
    });
  });

  test("AC-1 the history lives in the device's storage, not only in the running app", async () => {
    queueFetch(respond(200, tokyo));

    await generate(tokyo);
    await waitFor(() => {
      expect(historyCodes()).toEqual([displayed(tokyo)]);
    });
    await settle();

    await AsyncStorage.clear();
    await restart();
    await settle();

    expect(historyCodes()).toEqual([]);
  });

  test("AC-5 every address of the current result opens an encoded Google Maps query externally", async () => {
    queueFetch(respond(200, sapporo));

    await generate(sapporo);

    for (const address of sapporo.addresses) {
      await fireEvent.press(
        currentResult().getByRole("link", { name: mapLinkName(address) }),
      );
    }

    await waitFor(() => {
      expect(openedUrls()).toHaveLength(sapporo.addresses.length);
    });
    sapporo.addresses.forEach((address, index) => {
      expectMapUrlFor(openedUrls()[index] ?? "", address);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("AC-5 every address of each history entry opens its map, also after a restart", async () => {
    queueFetch(respond(200, sapporo), respond(200, tokyo));

    await generate(sapporo);
    await generate(tokyo);
    await restart();
    await waitFor(() => {
      expect(historyCodes()).toEqual([displayed(tokyo), displayed(sapporo)]);
    });

    const addresses = [...tokyo.addresses, ...sapporo.addresses];
    for (const address of addresses) {
      const links = history().getAllByRole("link", {
        name: mapLinkName(address),
      });
      expect(links).toHaveLength(1);
      const [link] = links;
      if (link === undefined) throw new Error("no map link");
      await fireEvent.press(link);
    }

    await waitFor(() => {
      expect(openedUrls()).toHaveLength(addresses.length);
    });
    addresses.forEach((address, index) => {
      expectMapUrlFor(openedUrls()[index] ?? "", address);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  const mapFailures: Array<{ kind: string; arrange: () => void }> = [
    {
      kind: "no app can handle the map link",
      arrange: () => {
        jest.mocked(Linking.canOpenURL).mockResolvedValue(false);
        jest
          .mocked(Linking.openURL)
          .mockRejectedValue(
            new Error("Could not open URL: No Activity found to handle Intent"),
          );
      },
    },
    {
      kind: "the map link fails to open",
      arrange: () => {
        jest
          .mocked(Linking.openURL)
          .mockRejectedValue(new Error("Unable to open URL"));
      },
    },
  ];

  test.each(mapFailures)(
    "AC-6 when $kind, an alert reports it and the result and history stay",
    async ({ arrange }) => {
      queueFetch(respond(200, tokyo), respond(200, sapporo));
      await generate(tokyo);
      await generate(sapporo);
      await waitFor(() => {
        expect(historyCodes()).toEqual([displayed(sapporo), displayed(tokyo)]);
      });
      arrange();

      const [address] = sapporo.addresses;
      if (address === undefined) throw new Error("no address");
      await fireEvent.press(
        currentResult().getByRole("link", { name: mapLinkName(address) }),
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
      });
      expect(currentResult().getByText(displayed(sapporo))).toBeTruthy();
      for (const shown of sapporo.addresses) {
        expect(currentResult().getByText(fullAddress(shown))).toBeTruthy();
      }
      expect(historyCodes()).toEqual([displayed(sapporo), displayed(tokyo)]);
      expect(
        screen.getByRole("button", { name: regenerateLabel }),
      ).toBeTruthy();
    },
  );

  test("AC-6 after a map failure, generating again still works and is recorded", async () => {
    queueFetch(respond(200, tokyo), respond(200, osaka));
    await generate(tokyo);
    jest
      .mocked(Linking.openURL)
      .mockRejectedValue(new Error("Unable to open URL"));
    const [address] = tokyo.addresses;
    if (address === undefined) throw new Error("no address");
    await fireEvent.press(
      currentResult().getByRole("link", { name: mapLinkName(address) }),
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    await generate(osaka);

    await waitFor(() => {
      expect(historyCodes()).toEqual([displayed(osaka), displayed(tokyo)]);
    });
  });

  test("AC-8 no history is sent to the server: every request is a bodiless GET of /api/random", async () => {
    const fetchMock = queueFetch(
      respond(200, tokyo),
      respond(200, sapporo),
      respond(200, osaka),
    );

    await generate(tokyo);
    await generate(sapporo);
    await restart();
    await waitFor(() => {
      expect(historyCodes()).toHaveLength(2);
    });
    const [address] = tokyo.addresses;
    if (address === undefined) throw new Error("no address");
    await fireEvent.press(
      history().getByRole("link", { name: mapLinkName(address) }),
    );
    await generate(osaka);
    await settle();

    // Restarting and opening a map asked the server for nothing.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expectNoServerSync(fetchMock);
  });
});
