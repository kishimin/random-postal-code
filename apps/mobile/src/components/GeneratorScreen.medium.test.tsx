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
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { AccessibilityInfo, Linking } from "react-native";
import { GeneratorScreen } from "./GeneratorScreen";

const origin = "https://api.example.test";

const tokyo = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const originalFetch = globalThis.fetch;

/**
 * Renders the screen as the start route, with the fetch it will use already
 * in place, so a request made while mounting is seen too.
 */
const renderScreen = async (request: typeof fetch): Promise<void> => {
  globalThis.fetch = request;
  await renderRouter({
    index: () => <GeneratorScreen apiBaseUrl={origin} />,
    info: () => null,
  });
};

const respondWithTokyo = (): typeof fetch =>
  jest.fn<typeof fetch>(() =>
    Promise.resolve(new Response(JSON.stringify(tokyo), { status: 200 })),
  );

const mapLinkName = "東京都千代田区千代田をGoogle マップで開く";
const mapFailureText =
  "地図を開けませんでした。Google マップを開けるアプリやブラウザが見つかりません。住所はこの画面の表示をご確認ください。";

const generate = async (): Promise<void> => {
  await fireEvent.press(
    screen.getByRole("button", { name: "ランダム生成する" }),
  );
  await screen.findAllByRole("link", { name: mapLinkName });
};

/** Presses the address link of the current result, not the history's. */
const openCurrentAddressInMap = async (): Promise<void> => {
  const current = screen.getByLabelText("今回の結果");
  await fireEvent.press(
    within(current).getByRole("link", { name: mapLinkName }),
  );
};

const mapFailureAnnouncements = () =>
  announce.mock.calls.filter(([message]) => message === mapFailureText);

const failToOpenMap = () =>
  jest
    .spyOn(Linking, "openURL")
    .mockRejectedValue(new Error("No Activity found to handle Intent"));

let announce: jest.SpiedFunction<
  typeof AccessibilityInfo.announceForAccessibility
>;

beforeEach(async () => {
  // The history is kept on the device, so what an earlier test generated
  // would otherwise be listed in this one.
  await AsyncStorage.clear();
  announce = jest
    .spyOn(AccessibilityInfo, "announceForAccessibility")
    .mockImplementation(() => undefined);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  announce.mockRestore();
  jest.restoreAllMocks();
});

describe("GeneratorScreen", () => {
  test("does not request a postal code while mounting", async () => {
    const request = jest.fn<typeof fetch>();

    await renderScreen(request);

    expect(request).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });

  test("announces the loading and the result to screen readers", async () => {
    await renderScreen(
      jest.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify(tokyo), { status: 200 })),
      ),
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "ランダム生成する" }),
    );

    await waitFor(() => {
      expect(announce).toHaveBeenLastCalledWith(
        "郵便番号 100-0001 を生成しました",
      );
    });
    expect(announce).toHaveBeenCalledWith("郵便番号を生成しています");
  });

  test("announces a failure, which iOS does not read from the alert alone", async () => {
    await renderScreen(
      jest.fn<typeof fetch>(() =>
        Promise.reject(new TypeError("Network request failed")),
      ),
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "ランダム生成する" }),
    );

    await waitFor(() => {
      expect(announce).toHaveBeenLastCalledWith(
        "場所を取得できませんでした。通信状態を確認して、もう一度お試しください。",
      );
    });
  });

  test("announces a map failure, which iOS does not read from the alert alone", async () => {
    failToOpenMap();
    await renderScreen(respondWithTokyo());
    await generate();

    await openCurrentAddressInMap();

    await waitFor(() => {
      expect(announce).toHaveBeenLastCalledWith(mapFailureText);
    });
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  test("announces every map failure, also while the alert is already shown", async () => {
    failToOpenMap();
    await renderScreen(respondWithTokyo());
    await generate();

    await openCurrentAddressInMap();
    await waitFor(() => {
      expect(mapFailureAnnouncements()).toHaveLength(1);
    });
    await openCurrentAddressInMap();

    await waitFor(() => {
      expect(mapFailureAnnouncements()).toHaveLength(2);
    });
  });

  test("clears the map failure when a new postal code is generated", async () => {
    failToOpenMap();
    await renderScreen(respondWithTokyo());
    await generate();
    await openCurrentAddressInMap();
    await screen.findByRole("alert");

    await fireEvent.press(
      screen.getByRole("button", { name: "もう一度、波に乗る" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  test("lists a result in the history with its own postal code and address", async () => {
    await renderScreen(respondWithTokyo());
    await generate();

    const entry = screen.getByLabelText("履歴 100-0001");

    // Read within the entry, so the current result showing the same values
    // cannot satisfy it.
    expect(within(entry).getByLabelText("郵便番号 100-0001")).toBeTruthy();
    expect(within(entry).getByText("東京都千代田区千代田")).toBeTruthy();
  });
});
