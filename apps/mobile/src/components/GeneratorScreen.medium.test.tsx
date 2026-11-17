import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { AccessibilityInfo } from "react-native";
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

let announce: jest.SpiedFunction<
  typeof AccessibilityInfo.announceForAccessibility
>;

beforeEach(() => {
  announce = jest
    .spyOn(AccessibilityInfo, "announceForAccessibility")
    .mockImplementation(() => undefined);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  announce.mockRestore();
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
});
