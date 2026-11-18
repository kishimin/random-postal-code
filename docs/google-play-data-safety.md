# Google Play Data safety and ads declaration

This is the answer sheet for the Android app's Play Console forms (Issue #20): the Data safety form and the App content declarations for ads and the advertising ID. Fill the forms from this file, not from memory, and keep it in step with the production build. `acceptance/mobile-google-play-release.medium.test.ts` reads the SDK versions below from the installed packages and fails when this file names an older one.

The Android production build is the subject: `eas build --platform android --profile production` with the production AdMob IDs (see `apps/mobile/README.md`). iOS is not covered; App Store delivery is not planned (`docs/design.md` section 6.3).

## What the app does with data

- Zipnami asks the Zipnami API for a random postal code and its addresses. The request carries no identifier of the person, the device or the advertising ID, and the API stores none (`docs/design.md` section 7).
- Generation history is kept only on the device, in `@react-native-async-storage/async-storage`, at most 20 entries. It is not collected: it never leaves the device and is not synchronised.
- The app uses no location, camera, microphone or contacts permission. The address maps are links that open Google Maps outside the app.
- The only other code that handles data is Google's advertising code, listed next.

## SDKs in the production build

Each line names an SDK and the exact version the production build installs.

- react-native-google-mobile-ads 17.4.0 (the React Native wrapper of Google AdMob; also provides `AdsConsent`)
- Google Mobile Ads SDK (Android) 25.5.0 (the AdMob SDK the wrapper bundles)
- User Messaging Platform (Android) 4.0.0 (Google's consent SDK, called through `AdsConsent`)
- @react-native-async-storage/async-storage 2.2.0 (on-device storage of the history; no network access)

When a version changes, update the line and re-read Google's current Data safety guidance for the new Google Mobile Ads SDK before the next release.

## Data safety form

Answer the form's first questions as follows.

| Question                                       | Answer                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Does the app collect or share user data?       | Yes. The Google Mobile Ads SDK collects the data types below.                                          |
| Is all of the data encrypted in transit?       | Yes. The Zipnami API is HTTPS only, and the Google Mobile Ads SDK sends its data encrypted in transit. |
| Do you provide a way to request data deletion? | No. The app holds no account and the developer holds no data. The history is deleted by uninstalling.  |
| Does the app follow the Families policy?       | Not applicable. The app is not designed for children.                                                  |

### Data types

These are the data types Google lists for the Google Mobile Ads SDK. Each is declared as collected and shared, because the SDK sends it to Google for the purposes shown. Data collected by the SDK is not required to use the app's features, so each type is declared as optional where the form asks.

| Category                 | Data type            | Purposes                                                           |
| ------------------------ | -------------------- | ------------------------------------------------------------------ |
| Location                 | Approximate location | Advertising or marketing, Analytics, Fraud prevention and security |
| App activity             | App interactions     | Advertising or marketing, Analytics, Fraud prevention and security |
| App info and performance | Crash logs           | Analytics                                                          |
| App info and performance | Diagnostics          | Analytics, Fraud prevention and security                           |
| Device or other IDs      | Device or other IDs  | Advertising or marketing, Analytics, Fraud prevention and security |

Device or other IDs covers the advertising ID, which the SDK reads when the person has not reset or opted out of it.

### Data types declared as not collected

- Personal info (name, email address, user IDs, address, phone number): the app has no account and no form.
- Precise location: the app never requests location permission.
- Photos and videos, audio files, files and docs, contacts, calendar, messages: the app does not use them.
- Generation history: kept only on the device and never sent anywhere, so it is not collected.
- Web browsing history, search history: not collected. A map link opens Google Maps in another app or the browser, which the person then uses under Google's own terms.

## Ads declaration

- Contains ads: Yes. The start screen shows one Google AdMob banner in its 広告 region.
- Advertising ID: the app uses it. Answer Yes under App content, Advertising ID, with the purposes Advertising or marketing, Analytics and Fraud prevention, security, and compliance. The manifest carries `com.google.android.gms.permission.AD_ID`, which the AdMob library adds when Gradle merges its manifest. The production config does not block it. Android 13 and later apps that target API 33 or later must declare the permission to read the advertising ID.
- Target audience: not designed for children. Do not enable child-directed treatment.

## Consent

The app asks for consent before any ad request, with Google's User Messaging Platform through `AdsConsent` (Issue #15).

- In the EEA, the UK and Switzerland, the person sees Google's consent form first. Where no form is required, the SDK reports `NOT_REQUIRED` and ads are personalised.
- When the person does not consent, or the consent state cannot be read, the app requests non-personalized ads only (`requestNonPersonalizedAdsOnly`). A failure at any consent step shows no banner.
- `delayAppMeasurementInit` is `true` in the `react-native-google-mobile-ads` plugin of `apps/mobile/app.config.ts`. Without it the SDK starts app measurement when the app launches, before the person has answered. With it, measurement starts only when the app calls `initialize()`, after the consent flow has finished (`apps/mobile/src/lib/ads-startup.ts`).
- The UMP messages are configured in the AdMob console (Privacy and messaging), outside this repository. They have to be published for the production app ID before release; the release checklist has the step.

## Assumptions

These are the points that could not be checked from the repository. Confirm them in Play Console before submitting.

- Google's current guidance for AdMob lists the data types above. The Google Mobile Ads SDK's behaviour can change with its version, so the table is a copy of that guidance on the day the SDK version above was installed, not a measurement of the network traffic.
- Declaring the data as collected and shared, and as optional, follows Google's AdMob guidance. If Play Console's wording at submission asks differently, follow the console and record the difference under Evidence in the release checklist.
- The privacy policy at https://zipnami.pages.dev/privacy describes the app's advertising, consent and history. It must be publicly reachable when the form is submitted.
