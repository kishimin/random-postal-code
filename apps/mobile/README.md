# Zipnami mobile

The Android and iOS app (Expo, React Native, Expo Router). `docs/design.md` §6.3 sets its boundary: it is developed alongside the Web MVP but is not part of it.

## Configuration

Build-time settings are `EXPO_PUBLIC_*` variables. [`.env.example`](.env.example) lists them. Copy it to `apps/mobile/.env`, which Git ignores, or set the variables in the shell. Expo inlines them into the bundle, so none of them may be a secret.

| Variable                                | Used for                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL`              | The Zipnami API origin                                                                    |
| `EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID` | The AdMob banner unit of the Android app, used by release builds only (Issue #15)         |
| `EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS`     | The AdMob banner unit of the iOS app, used by release builds only (Issue #15)             |
| `EXPO_PUBLIC_AD_BANNER_UNIT_ID`         | Deprecated alias for the Android unit, read only when the Android variable is unset       |
| `ADMOB_ANDROID_APP_ID`                  | The AdMob app ID written into `AndroidManifest.xml`; not inlined, read by `app.config.ts` |
| `ADMOB_IOS_APP_ID`                      | The AdMob app ID written into `Info.plist`; not inlined, read by `app.config.ts`          |

## Ads

The start screen shows one AdMob banner in its 「広告」 region (Issue #15). The owner chose `react-native-google-mobile-ads` for AdMob and its built-in `AdsConsent` for Google's User Messaging Platform consent, and `expo-tracking-transparency` for iOS App Tracking Transparency (Issue #15, option A, 2026-11-18). On every launch the app runs consent first, then (iOS only) the tracking prompt, then starts the SDK, and only then requests a banner. A refusal falls back to non-personalised ads, and a failure at any step shows no banner and never affects generating, history or the map links. A banner that fails to load is requested again at most twice.

Where Google's SDK reports that privacy options are required, the start screen also shows a 「広告のプライバシー設定」 button outside the ad region (Issue #146). It reopens the privacy-options form, and the next banner is requested under what the person chose there: non-personalised unless personalised ads and storing information on the device are both allowed, and no banner at all once consent is withdrawn. A failure to open the form changes nothing.

No production AdMob IDs exist yet, so every build uses Google's test IDs:

- The app IDs fall back to Google's sample app IDs when `ADMOB_ANDROID_APP_ID` or `ADMOB_IOS_APP_ID` is unset or empty.
- A development build or an automated run (`__DEV__`) always requests Google's test banner, even when a banner unit variable is set. A release build uses the unit of its platform when one is set, and the test banner otherwise.

When AdMob is set up, put the four IDs in the `env` of the `production` profile in [`eas.json`](eas.json) and nowhere else: a non-production profile must stay on the test IDs. A production Android build also blocks the permissions the app never uses (overlay, vibrate and external storage), which leaves the network and the advertising ID.

Set the production AdMob IDs only for the EAS `production` profile, never in a local `.env`, the shell, or another profile. Pre-release builds rely on the IDs being unset to fall back to Google's test IDs, and a production ID in a development or preview build would count test traffic on the real AdMob account. The `production` profile enforces the other direction: its build fails, naming the variable, when any of the four IDs is unset or empty, so it can never ship with Google's test IDs.

## Development

Run these from the repository root.

The app runs as a development build (`expo-dev-client`), not in Expo Go, which `docs/design.md` §6.3 rules out.

| Command                                           | What it does                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `bun run --filter @zipnami/mobile run:android`    | Builds the development build locally (Android SDK required) and installs it on the running emulator or USB device |
| `bun run --filter @zipnami/mobile start`          | Starts the Metro dev server for an installed development build                                                    |
| `bun run --filter @zipnami/mobile android`        | Starts Metro and opens the installed development build on Android                                                 |
| `bun run --filter @zipnami/mobile export:android` | Bundles the app for Android into `apps/mobile/dist`                                                               |
| `bun run --filter @zipnami/mobile export:ios`     | Bundles the app for iOS into `apps/mobile/dist`                                                                   |

To see the app start on Android (checked once in Issue #20's release verification):

1. Start an emulator from Android Studio's Device Manager, or connect a phone with USB debugging on.
2. Run `bun run --filter @zipnami/mobile run:android`. The first run generates `apps/mobile/android` (ignored by Git) and takes several minutes.
3. The start screen shows `ZIPNAMI` and a `ランダム生成する` button. Pressing it asks the API at `EXPO_PUBLIC_API_BASE_URL` (HTTPS only) for a postal code and shows it with every address. The `Zipnami について` link opens the information screen.

The same development build can be built on EAS instead of locally. EAS CLI reads `app.json` and `eas.json` from the directory it runs in, so run it from `apps/mobile`, not from the repository root. The project must be linked to an Expo account first (`bunx eas-cli init`, once):

```bash
cd apps/mobile
bunx eas-cli build --platform android --profile development
```

The Android application ID (`android.package`) and the iOS bundle identifier (`ios.bundleIdentifier`) in `app.json` are both `io.github.kishimin.zipnami`, the owner's choice in Issue #12. It is the app's permanent identity on Google Play and the App Store, so do not change it after the first release.

## Production

Production builds run on EAS Build and need an Expo account (`bunx eas-cli login`). Run them from `apps/mobile` as well:

```bash
cd apps/mobile
bunx eas-cli build --platform android --profile production
```

The `production` profile in [`eas.json`](eas.json) builds an Android App Bundle for Google Play (Issue #20). App Store delivery is not planned (`docs/design.md` §6.3), so there is no iOS production profile beyond EAS's defaults; `export:ios` checks that the iOS bundle builds.

Everything else a Google Play release needs is written down, not scripted:

- [`docs/google-play-release-checklist.md`](../../docs/google-play-release-checklist.md) lists every step only the owner can run (production AdMob IDs, the build, screenshots, Play Console forms, the test track, and the checks on a device).
- [`docs/google-play-data-safety.md`](../../docs/google-play-data-safety.md) is the answer sheet for the Data safety and ads declarations. It names the exact SDK versions, so it has to change when one of them does.
- [`fastlane/metadata/android/ja-JP`](fastlane/metadata/android/ja-JP) holds the Japanese store listing: the title, the short and full descriptions, the 512px icon and the feature graphic. The app icon, adaptive icon and splash image in [`assets`](assets) are made from the Web logo; the phone screenshots are not in the repository.

## Checks

| Command                                         | What it does                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `bun run --filter @zipnami/mobile typecheck`    | TypeScript                                                               |
| `bun run --filter @zipnami/mobile lint`         | oxlint and ESLint                                                        |
| `bun run --filter @zipnami/mobile test:small`   | Small tests of the logic that runs without React Native                  |
| `bun run --filter @zipnami/mobile test:medium`  | The export-based acceptance tests (Vitest), then the screen tests (Jest) |
| `bun run --filter @zipnami/mobile test:screens` | The screen tests alone, rendered once as iOS and once as Android         |

The screen tests render React Native, which Vitest cannot, so they run under Jest with the `jest-expo/ios` and `jest-expo/android` presets ([`jest.config.js`](jest.config.js)). Logic and export tests stay on Vitest.

Metro uses Expo's built-in monorepo support. There is no `metro.config.js`: workspace packages such as `@zipnami/shared` resolve without `watchFolders` or resolver overrides.
