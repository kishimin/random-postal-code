# Google Play release checklist

This is the list of steps that prepare the Android app for Google Play (Issue #20) and that only the owner can run, because they need the owner's Expo, AdMob and Google Play accounts, or a device or emulator. What the repository can check by itself is held by `acceptance/mobile-google-play-release.medium.test.ts` and `acceptance/mobile-app-privacy-policy.medium.test.ts`.

A box is ticked only after the step it names has been run and passed. Record the date, the build or version, and what was seen under Evidence. A step that cannot be run yet stays open and says what it waits for.

The listing text and images are in `apps/mobile/fastlane/metadata/android/ja-JP`, the layout `fastlane supply` reads. The Data safety and advertising answers are in `docs/google-play-data-safety.md`.

## Accounts and production IDs

- [ ] A Google Play Console developer account exists and the app is created in it with the package name `io.github.kishimin.zipnami` (the package name cannot be changed afterwards).
- [ ] The AdMob app and its Android banner unit exist, and the User Messaging Platform messages (Privacy and messaging in the AdMob console) are published for the app, so the consent form can appear in the EEA, the UK and Switzerland.
- [ ] In the EAS production environment, set ADMOB_ANDROID_APP_ID, ADMOB_IOS_APP_ID, EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID and EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS, for example `cd apps/mobile` then `bunx eas-cli env:create --environment production --name ADMOB_ANDROID_APP_ID --value <the ID> --visibility plaintext`, once for each of the four. The production profile refuses to build while any of them is unset, and no other profile or CI workflow may hold them.
- [ ] `bunx eas-cli env:list --environment production` in `apps/mobile` shows all four variables.

## Build

- [ ] In `apps/mobile`, run `eas build --platform android --profile production` (as `bunx eas-cli build --platform android --profile production` when EAS CLI is not installed), and wait for the build to finish. It produces an Android App Bundle (`.aab`); download it from the build page.
- [ ] Review the merged manifest of the AAB (in Android Studio, Build, Analyze APK, then open the `.aab`, or `bundletool dump manifest`). It asks for the network and `com.google.android.gms.permission.AD_ID` and for no location, camera, microphone or contacts permission, and its AdMob application ID is the production one, not Google's sample `ca-app-pub-3940256099942544~3347511713`.

## Store images

- [ ] Review the app icon, the adaptive icon (foreground and monochrome layers, on a circle, a rounded square and a squircle mask), the splash screen and the feature graphic (`images/featureGraphic.png`, 1024x500) with your own eyes. They come from the Zipnami logo of the Web site; say here if any of them needs to change.
- [ ] Take phone screenshots of the production build on an emulator or a device: the start screen, a generated postal code with its addresses, and the history. Upload at least two to the listing's phone screenshots. They are not in the repository.

## Listing and declarations

- [ ] In Play Console, open Main store listing, choose the default language Japanese, and enter the title, short description and full description from `apps/mobile/fastlane/metadata/android/ja-JP`, then upload `images/icon.png` as the app icon and `images/featureGraphic.png` as the feature graphic.
- [ ] Enter the privacy policy URL https://zipnami.pages.dev/privacy under App content.
- [ ] Open https://zipnami.pages.dev/privacy in a browser that is not signed in, after the deploy that contains the Android app's wording, and confirm that it answers 200 and names the Android app, Google AdMob, the advertising ID, consent, and the history kept on the device.
- [ ] Fill the Data safety form from `docs/google-play-data-safety.md`, answering each question as that file does, and save it.
- [ ] Fill the ads declaration (Contains ads: Yes), the advertising ID declaration, the target audience (not for children) and the content rating questionnaire, from `docs/google-play-data-safety.md`.

## Test track

- [ ] Create a release on the internal testing track, upload the AAB, add yourself as a tester, and install the app from the testing link on a device.
- [ ] If the developer account is a personal account that Play requires to run a closed testing period before production, run the closed testing track for the number of testers and days Play Console shows, and record the dates.
- [ ] Review the feedback and the crashes in Play Console (Test and release, Android vitals, Crashes and ANRs) from the test track, and fix or record every one before the production release.

## Release verification

Run these on the production build installed from the test track, on an emulator or a device, with the network on unless a step says otherwise.

- [ ] The production build starts on an emulator or a device and shows the start screen with the Zipnami title and the generate button.
- [ ] API: pressing the generate button shows a postal code and every address of it, from the production API, and pressing it again shows another.
- [ ] History: each generated postal code is added to the history, newest first, the history keeps the 20 newest, it is still there after the app is closed and opened again, and the app does not send it anywhere.
- [ ] External maps: choosing an address opens Google Maps with that address, outside the app, and the app asks for no location permission.
- [ ] Ads: the 広告 region shows a banner from the production ad unit, and the banner does not cover the generate button or the result. A new install on a device in the EEA, the UK or Switzerland shows the consent form before the banner appears; elsewhere the banner appears without a form. Record the device's region.
- [ ] Consent: where the consent form appears, refusing it still leaves every feature of the app working and shows only non-personalized ads. Skip this step, and say so under Evidence, when no test device is in a region that shows the form.
- [ ] Offline: with airplane mode on, generating shows an error and keeps the last result and the history, and generating works again once the network is back.

## Production release

- [ ] Promote the tested release to the production track, with the release notes from `CHANGELOG.md`, and send it for review.
- [ ] After Google approves it, install the app from the Play Store listing and repeat the start screen check above once.

## Evidence

Nothing is recorded yet. For each ticked box, add the date, the build or version, and what was seen, here.
