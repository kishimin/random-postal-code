import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import path from "node:path";

/*
 * Acceptance test for Issue #174: the mobile address links look tappable
 * without relying on colour, and stay what screen readers already announce.
 *
 * Only AC-4 is pinned here: each address link is announced once, with role
 * link and the label 「…をGoogle マップで開く」, and nothing decorative inside
 * it is announced on its own. It already holds before the change; it is the
 * criterion the new visual cue must not break, so it starts Green.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - AC-2, AC-3 and AC-5 (the underline, the pressed state, the 44pt height
 *   and AA contrast). They are appearance, and AC-6 asks for them to be
 *   checked visually, not by reading colour or size values.
 * - AC-1 (docs/ui-design.md is updated first). That is a document order,
 *   reviewed in the pull request.
 *
 * The app's own route directory is rendered through Expo Router's testing
 * library under both jest-expo presets, as in Issues #13 and #14.
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

// A real postal code that Japan Post assigns to more than one town, so a
// region with several links is covered too.
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

const linkNames = [
  "北海道札幌市中央区以下に掲載がない場合をGoogle マップで開く",
  "北海道札幌市中央区大通西をGoogle マップで開く",
];

const originalFetch = globalThis.fetch;

beforeEach(async () => {
  await AsyncStorage.clear();
  globalThis.fetch = jest.fn<typeof fetch>(() =>
    Promise.resolve(new Response(JSON.stringify(sapporo), { status: 200 })),
  );
  await renderRouter(appDirectory);
  await fireEvent.press(
    await screen.findByRole("button", { name: "ランダム生成する" }),
  );
  await screen.findAllByRole("link", { name: linkNames[0] });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Issue #174: mobile map links", () => {
  test.each(["今回の結果", "生成の履歴"])(
    "AC-4: in 「%s」, each address is one link with its map label, and nothing inside it is announced separately",
    (regionLabel) => {
      const region = screen.getByLabelText(regionLabel);
      const links = within(region).getAllByRole("link");
      expect(
        links.map((link) => link.props.accessibilityLabel as unknown),
      ).toEqual(linkNames);
      for (const link of links) {
        // A decorative icon or cue inside the link must not become a second
        // stop for TalkBack or VoiceOver.
        expect(within(link).queryAllByRole("image")).toEqual([]);
        expect(within(link).queryAllByRole("link")).toEqual([]);
      }
    },
  );
});
