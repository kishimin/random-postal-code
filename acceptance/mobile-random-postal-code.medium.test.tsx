import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import path from "node:path";
import { Platform } from "react-native";

/*
 * Acceptance test for Issue #13: the mobile random postal-code experience
 * for Android and iOS.
 *
 * Each test name starts with the criterion it holds (AC-1 … AC-9, in the
 * Issue's order). AC-5 and AC-10 are about the built bundle and live in
 * mobile-random-postal-code-bundle.medium.test.ts, which runs `expo export`.
 *
 * How the app is exercised
 * ------------------------
 * The app's own route directory, apps/mobile/src/app, is rendered through
 * Expo Router's testing library, so the screen, its layout, and the link to
 * the information route are the ones that ship. The owner chose jest,
 * jest-expo, and React Native Testing Library on Issue #13 (option A) so
 * that this one file runs once with the iOS preset and once with the
 * Android preset; AC-9's "for both platforms" is that pair of runs, and the
 * bundle test checks that both presets are configured.
 *
 * The network is the one thing replaced: `fetch` is a Jest mock that answers
 * like the Hono `GET /api/random` contract (api-design.md sections 3 and
 * 4.2), or fails the way React Native's fetch does when the device is
 * offline. The API origin is given the way a build gives it, through
 * EXPO_PUBLIC_API_BASE_URL, before the routes are loaded.
 *
 * What users see and hear
 * -----------------------
 * The copy is the Web generator's (apps/web/frontend site text), so both
 * clients say the same thing: the generate action is 「ランダム生成する」
 * before a result, 「もう一度、波に乗る」 after one, and 「再試行する」
 * after a failure. Queries go through roles and accessibility labels, which
 * are what TalkBack and VoiceOver read (AC-8).
 *
 * The current result is the region labelled 「今回の結果」. Assertions about
 * what replaced what are scoped to it, because Issue #14 adds a history
 * list on the same screen that will keep earlier postal codes visible.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - That TalkBack or VoiceOver actually speak. No device or emulator runs in
 *   CI or in the unattended loop, and docs/design.md section 6.3 rules out
 *   an iOS device check. The roles and labels those services read are
 *   pinned instead.
 * - Layout, colours, and type sizes. Those are verified visually, not by
 *   reading style values.
 * - The history list's contents (Issue #14) and the ad itself (Issue #15).
 *   Only that their areas exist on the screen is AC-1's.
 */

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

type Body = Record<string, unknown>;

const tokyo = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

// A real postal code that Japan Post assigns to more than one town.
const sapporo = {
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

const respond = (status: number, body: Body): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const apiError = (status: number, code: string): Response =>
  respond(status, {
    error: { code, message: "unavailable", requestId: "req-acceptance" },
  });

/** A fetch that answers each call with the next queued outcome. */
const queueFetch = (
  ...outcomes: Array<Response | Error | Promise<Response>>
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

/** A response the test releases when it chooses, to hold the loading state. */
const deferred = (): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} => {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** React Native's fetch rejects this way when there is no connection. */
const offline = (): Error => new TypeError("Network request failed");

const generateButton = (name: string) => screen.getByRole("button", { name });

const currentResult = () => within(screen.getByLabelText(currentResultLabel));

const expectShowsResult = async (result: typeof tokyo): Promise<void> => {
  const code = `〒${result.postalCode.slice(0, 3)}-${result.postalCode.slice(3)}`;
  await waitFor(() => {
    expect(currentResult().getByText(code)).toBeTruthy();
  });
  for (const address of result.addresses) {
    expect(
      currentResult().getByText(
        `${address.prefecture}${address.city}${address.town}`,
      ),
    ).toBeTruthy();
  }
};

const originalFetch = globalThis.fetch;

/**
 * The fetch in place while the app mounts, before a test queues anything
 * (Issue #142). It answers nothing: a request made then fails the test in
 * afterEach rather than reaching the real network.
 */
let mountFetch: jest.Mock<typeof fetch>;

// Expo Router's renderRouter and Testing Library's fireEvent are both
// asynchronous: each settles React's updates before it resolves.
beforeEach(async () => {
  mountFetch = jest.fn<typeof fetch>(() =>
    Promise.reject(new Error("the app made a request the test did not queue")),
  );
  globalThis.fetch = mountFetch;
  await renderRouter(appDirectory, { initialUrl: "/" });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  // Every test's queued fetch replaces this one, so any call it saw came
  // from mounting, or from a test that requested before queueing.
  expect(
    mountFetch.mock.calls.map(([input]) =>
      input instanceof Request ? input.url : String(input),
    ),
  ).toEqual([]);
});

describe(`Issue #13 on ${Platform.OS}: the mobile random postal-code experience`, () => {
  test("AC-9 runs as the iOS or the Android platform, not as Web", () => {
    expect(["ios", "android"]).toContain(Platform.OS);
  });

  test("AC-1 the screen shows the branding, the action, the history and banner areas, and the information link", () => {
    expect(screen.getByText("ZIPNAMI")).toBeTruthy();
    expect(generateButton(startLabel)).toBeTruthy();
    expect(screen.getByRole("header", { name: "生成の履歴" })).toBeTruthy();
    expect(screen.getByLabelText("広告")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Zipnami について" })).toBeTruthy();
  });

  test("AC-1 a result shows its postal code and every address", async () => {
    queueFetch(respond(200, sapporo));

    await fireEvent.press(generateButton(startLabel));

    await expectShowsResult(sapporo);
  });

  test("AC-2 the first display does not request a postal code", async () => {
    // Nothing is queued, so the fetch installed before the render is still
    // in place and sees a request made on mount (Issue #142). Effects run
    // inside the awaited render; draining the microtask queue as well
    // catches one started from a promise. Timers are not used to wait: Expo
    // Router's testing library may install fake ones, and a timer would
    // never fire.
    await act(async () => {
      for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
    });

    expect(mountFetch).not.toHaveBeenCalled();
    expect(currentResult().queryByText(/〒\d{3}-\d{4}/)).toBeNull();
  });

  test("AC-3 generation calls the HTTPS Hono API and shows the valid result", async () => {
    const fetchMock = queueFetch(respond(200, tokyo));

    await fireEvent.press(generateButton(startLabel));

    await expectShowsResult(tokyo);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(input instanceof Request ? input.url : input));
    expect(url.protocol).toBe("https:");
    expect(`${url.origin}${url.pathname}`).toBe(`${apiBaseUrl}/api/random`);
  });

  test("AC-4 re-generation replaces the current result", async () => {
    queueFetch(respond(200, tokyo), respond(200, sapporo));

    await fireEvent.press(generateButton(startLabel));
    await expectShowsResult(tokyo);
    await fireEvent.press(generateButton(regenerateLabel));

    await expectShowsResult(sapporo);
    expect(currentResult().queryByText("〒100-0001")).toBeNull();
    expect(currentResult().queryByText("東京都千代田区千代田")).toBeNull();
  });

  test("AC-6 while loading, a second press sends no second request and the action reports busy", async () => {
    const pending = deferred();
    const fetchMock = queueFetch(pending.promise, respond(200, sapporo));

    await fireEvent.press(generateButton(startLabel));
    await waitFor(() => {
      expect(screen.getByRole("button", { busy: true })).toBeTruthy();
    });
    await fireEvent.press(screen.getByRole("button", { busy: true }));
    await fireEvent.press(screen.getByRole("button", { busy: true }));

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(respond(200, tokyo));
      await pending.promise;
    });
    await expectShowsResult(tokyo);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("AC-6 while loading, the information link still navigates", async () => {
    const pending = deferred();
    queueFetch(pending.promise);

    await fireEvent.press(generateButton(startLabel));
    await waitFor(() => {
      expect(screen.getByRole("button", { busy: true })).toBeTruthy();
    });
    await fireEvent.press(
      screen.getByRole("link", { name: "Zipnami について" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Zipnamiは、日本の郵便番号をランダムに1つ表示するアプリです。",
        ),
      ).toBeTruthy();
    });

    await act(async () => {
      pending.resolve(respond(200, tokyo));
      await pending.promise;
    });
  });

  const failures: Array<{
    kind: string;
    outcome: () => Response | Error;
    message: string;
  }> = [
    {
      kind: "an API error",
      outcome: () => apiError(503, "DATA_UNAVAILABLE"),
      message:
        "サーバーが混み合っています。しばらくしてからもう一度お試しください。",
    },
    {
      kind: "an internal API error",
      outcome: () => apiError(500, "INTERNAL_ERROR"),
      message:
        "サーバーで問題が発生しました。しばらくしてからもう一度お試しください。",
    },
    {
      kind: "malformed data",
      outcome: () => respond(200, { postalCode: "100-0001", addresses: [] }),
      message: "予期しない応答を受信しました。もう一度お試しください。",
    },
    {
      kind: "being offline",
      outcome: offline,
      message: "通信状態を確認して、もう一度お試しください。",
    },
  ];

  test.each(failures)(
    "AC-7 $kind is explained as an alert and can be retried",
    async ({ outcome, message }) => {
      const fetchMock = queueFetch(outcome(), respond(200, tokyo));

      await fireEvent.press(generateButton(startLabel));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
      });
      expect(within(screen.getByRole("alert")).getByText(message)).toBeTruthy();

      await fireEvent.press(generateButton(retryLabel));

      await expectShowsResult(tokyo);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  test("AC-7 a failure after a result keeps the alert and the retry action reachable", async () => {
    queueFetch(respond(200, tokyo), offline(), respond(200, sapporo));

    await fireEvent.press(generateButton(startLabel));
    await expectShowsResult(tokyo);
    await fireEvent.press(generateButton(regenerateLabel));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    await fireEvent.press(generateButton(retryLabel));

    await expectShowsResult(sapporo);
  });

  test("AC-8 every control and state is exposed with a role and a label", async () => {
    queueFetch(respond(200, tokyo), offline());

    expect(generateButton(startLabel)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Zipnami について" })).toBeTruthy();

    await fireEvent.press(generateButton(startLabel));
    await expectShowsResult(tokyo);
    // The postal code is read as a labelled value, not as bare digits.
    expect(currentResult().getByLabelText("郵便番号 100-0001")).toBeTruthy();
    expect(generateButton(regenerateLabel)).toBeTruthy();

    await fireEvent.press(generateButton(regenerateLabel));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(generateButton(retryLabel)).toBeTruthy();
  });
});
