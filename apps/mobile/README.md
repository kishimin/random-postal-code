# Zipnami mobile

The Android and iOS app (Expo, React Native, Expo Router). `docs/design.md` §6.3 sets its boundary: it is developed alongside the Web MVP but is not part of it.

## Configuration

Build-time settings are `EXPO_PUBLIC_*` variables. [`.env.example`](.env.example) lists them. Copy it to `apps/mobile/.env`, which Git ignores, or set the variables in the shell. Expo inlines them into the bundle, so none of them may be a secret.

| Variable                        | Used for                             |
| ------------------------------- | ------------------------------------ |
| `EXPO_PUBLIC_API_BASE_URL`      | The Zipnami API origin               |
| `EXPO_PUBLIC_AD_BANNER_UNIT_ID` | The AdMob banner ad unit (Issue #15) |

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

To see the app start on Android (Issue #12, criterion 1):

1. Start an emulator from Android Studio's Device Manager, or connect a phone with USB debugging on.
2. Run `bun run --filter @zipnami/mobile run:android`. The first run generates `apps/mobile/android` (ignored by Git) and takes several minutes.
3. The start screen shows `ZIPNAMI` and a `Zipnami について` link that opens the information screen.

The same development build can be built on EAS instead of locally. The project must be linked to an Expo account first (`bunx eas-cli init`, once):

```bash
bunx eas-cli build --platform android --profile development
```

The Android application ID (`android.package` in `app.json`) is not set yet. It becomes the app's permanent identity on Google Play, so the owner chooses it (Issue #12). Until then, `run:android` and EAS ask for one.

## Production

Production builds run on EAS Build and need an Expo account (`bunx eas-cli login`).

```bash
bunx eas-cli build --platform android --profile production
```

The `production` profile in [`eas.json`](eas.json) builds an Android App Bundle for Google Play (Issue #20). App Store delivery is not planned (`docs/design.md` §6.3), so there is no iOS production profile beyond EAS's defaults; `export:ios` checks that the iOS bundle builds.

## Checks

| Command                                        | What it does                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `bun run --filter @zipnami/mobile typecheck`   | TypeScript                                                                  |
| `bun run --filter @zipnami/mobile lint`        | oxlint and ESLint                                                           |
| `bun run --filter @zipnami/mobile test:small`  | Small tests of the logic that runs without React Native                     |
| `bun run --filter @zipnami/mobile test:medium` | The Issue #12 acceptance test: exports both platforms and checks the result |

Metro uses Expo's built-in monorepo support. There is no `metro.config.js`: workspace packages such as `@zipnami/shared` resolve without `watchFolders` or resolver overrides.
