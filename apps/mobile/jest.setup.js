jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// The ad SDK and the tracking prompt are native modules that do not exist
// under Jest, and every screen test renders the start screen that starts
// them. By default the stand-ins answer as a person in a region that
// requires consent who has not given it would: no ad is ever requested, so a
// screen test sees the app exactly as it was before ads. The ad acceptance
// test replaces both with fakes that record what the app asks for.
jest.mock("react-native-google-mobile-ads", () => ({
  __esModule: true,
  default: () => ({ initialize: async () => [] }),
  AdsConsent: {
    gatherConsent: async () => ({ status: "REQUIRED", canRequestAds: false }),
    getUserChoices: async () => ({ selectPersonalisedAds: false }),
  },
  BannerAd: () => null,
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: "ANCHORED_ADAPTIVE_BANNER" },
  TestIds: { ADAPTIVE_BANNER: "test-adaptive-banner" },
}));

jest.mock("expo-tracking-transparency", () => ({
  __esModule: true,
  requestTrackingPermissionsAsync: async () => ({
    status: "denied",
    granted: false,
  }),
}));
