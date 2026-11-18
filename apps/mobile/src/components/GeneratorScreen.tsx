import type { Address, PostalCode } from "@zipnami/shared";
import { Link } from "expo-router";
import { useCallback, useEffect } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { mobileConfig } from "../config/env";
import { useAdsStartup } from "../hooks/use-ads-startup";
import { useExternalMap } from "../hooks/use-external-map";
import { useGenerationHistory } from "../hooks/use-generation-history";
import { useGenerator } from "../hooks/use-generator";
import { announcementOf } from "../lib/generator-announcement";
import type { GeneratorState } from "../lib/generator-state";
import { shownResultOf } from "../lib/generator-state";
import { generatorText } from "../lib/generator-text";
import { fullAddressText } from "../lib/map-url";
import { formatPostalCode } from "../lib/postal-code-label";
import { AdRegion } from "./AdRegion";
import { PrivacyOptionsButton } from "./PrivacyOptionsButton";

const actionLabelOf = (state: GeneratorState): string => {
  switch (state.status) {
    case "idle":
      return generatorText.startAction;
    case "loading":
      return generatorText.loadingAction;
    case "success":
      return generatorText.regenerateAction;
    case "error":
      return generatorText.retryAction;
  }
};

/** One address, which opens in the device's map when pressed. */
const AddressLink = ({
  address,
  onOpen,
}: {
  address: Address;
  onOpen: (address: Address) => void;
}) => {
  const text = fullAddressText(address);
  return (
    <Pressable
      accessibilityLabel={generatorText.mapLinkLabel(text)}
      accessibilityRole="link"
      onPress={() => {
        onOpen(address);
      }}
      style={styles.addressLink}
    >
      <Text style={styles.address}>{text}</Text>
    </Pressable>
  );
};

/** Every address of a postal code. */
const AddressLinks = ({
  addresses,
  onOpen,
}: {
  addresses: readonly Address[];
  onOpen: (address: Address) => void;
}) =>
  addresses.map((address, index) => (
    // One postal code can list the same town twice in Japan Post's data, so
    // the position is part of the key.
    <AddressLink
      key={`${index}:${fullAddressText(address)}`}
      address={address}
      onOpen={onOpen}
    />
  ));

const CurrentResult = ({
  result,
  onOpenMap,
}: {
  result: PostalCode | undefined;
  onOpenMap: (address: Address) => void;
}) => {
  const displayed =
    result === undefined ? undefined : formatPostalCode(result.postalCode);
  return (
    // Labelled but not `accessible`: grouping would make VoiceOver read the
    // label alone and skip the postal code and addresses inside.
    <View
      accessibilityLabel={generatorText.currentResultLabel}
      style={styles.result}
    >
      <Text accessibilityRole="header" style={styles.resultHeading}>
        {generatorText.resultHeading}
      </Text>
      {displayed === undefined || result === undefined ? (
        <Text style={styles.postalCode}>{generatorText.mysteryCode}</Text>
      ) : (
        <>
          <Text
            accessibilityLabel={generatorText.postalCodeLabel(
              displayed.slice(1),
            )}
            style={styles.postalCode}
          >
            {displayed}
          </Text>
          <AddressLinks addresses={result.addresses} onOpen={onOpenMap} />
        </>
      )}
    </View>
  );
};

/**
 * One past result. Its postal code is read the way the current result's is,
 * and the entry is named so a screen reader can tell which result an address
 * belongs to.
 */
const HistoryEntry = ({
  entry,
  onOpenMap,
}: {
  entry: PostalCode;
  onOpenMap: (address: Address) => void;
}) => {
  const displayed = formatPostalCode(entry.postalCode);
  const readable = displayed?.slice(1);
  return (
    // Labelled but not `accessible`, for the reason the current result is not.
    <View
      accessibilityLabel={
        readable === undefined
          ? undefined
          : generatorText.historyEntryLabel(readable)
      }
      style={styles.entry}
    >
      <Text
        accessibilityLabel={
          readable === undefined
            ? undefined
            : generatorText.postalCodeLabel(readable)
        }
        style={styles.entryCode}
      >
        {displayed ?? generatorText.mysteryCode}
      </Text>
      <AddressLinks addresses={entry.addresses} onOpen={onOpenMap} />
    </View>
  );
};

const HistoryList = ({
  history,
  onOpenMap,
}: {
  history: readonly PostalCode[];
  onOpenMap: (address: Address) => void;
}) => (
  <View
    accessibilityLabel={generatorText.historyHeading}
    style={styles.history}
  >
    {history.length === 0 ? (
      <Text style={styles.caption}>{generatorText.historyEmpty}</Text>
    ) : (
      history.map((entry, index) => (
        // A postal code can repeat, so the position is part of the key.
        <HistoryEntry
          key={`${index}:${entry.postalCode}`}
          entry={entry}
          onOpenMap={onOpenMap}
        />
      ))
    )}
  </View>
);

/**
 * The start route's content (Issues #13 and #14): generate a random postal
 * code from the Hono API, show it with every address, keep the recent
 * results on the device, and open any address in the device's map.
 */
export const GeneratorScreen = ({
  apiBaseUrl = mobileConfig.apiBaseUrl,
}: {
  apiBaseUrl?: string | undefined;
}) => {
  const { history, record } = useGenerationHistory();
  const { state, generate } = useGenerator(apiBaseUrl, record);
  const map = useExternalMap();
  const ads = useAdsStartup();
  const { dismiss: dismissMapFailure, failureCount } = map;
  const loading = state.status === "loading";

  const generateAgain = useCallback(() => {
    // A map failure belongs to the result it was reported for.
    dismissMapFailure();
    generate();
  }, [dismissMapFailure, generate]);

  // The screen reader is an external system the screen keeps in step with
  // the request lifecycle. Each dispatch makes a new state object, so one
  // transition is announced once.
  useEffect(() => {
    const message = announcementOf(state);
    if (message !== undefined) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [state]);

  // The map failure is announced the same way, for the same reason: iOS
  // does not read an alert that appears by itself. It follows the count, not
  // `failed`, so a second failure while the alert is still shown is announced
  // too.
  useEffect(() => {
    if (failureCount > 0) {
      AccessibilityInfo.announceForAccessibility(
        `${generatorText.mapFailureHeading}。${generatorText.mapFailureBody}`,
      );
    }
  }, [failureCount]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={styles.brand}>
        {generatorText.brand}
      </Text>
      <Text style={styles.intro}>{generatorText.intro}</Text>

      <CurrentResult result={shownResultOf(state)} onOpenMap={map.open} />

      {state.status === "error" ? (
        // `accessible` makes the alert one element, so TalkBack and
        // VoiceOver read the heading and the explanation together when
        // focused. It has no live region: the effect above announces the
        // failure on both platforms, and a live region would make TalkBack
        // read it twice.
        <View accessible accessibilityRole="alert" style={styles.alert}>
          <Text style={styles.alertHeading}>
            {generatorText.failureHeading}
          </Text>
          <Text style={styles.alertBody}>
            {generatorText.failure[state.failure]}
          </Text>
        </View>
      ) : null}

      {map.failed ? (
        <View accessible accessibilityRole="alert" style={styles.alert}>
          <Text style={styles.alertHeading}>
            {generatorText.mapFailureHeading}
          </Text>
          <Text style={styles.alertBody}>{generatorText.mapFailureBody}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled: loading }}
        disabled={loading}
        onPress={generateAgain}
        style={({ pressed }) => [
          styles.action,
          (pressed || loading) && styles.actionMuted,
        ]}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
        <Text style={styles.actionLabel}>{actionLabelOf(state)}</Text>
      </Pressable>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionHeading}>
          {generatorText.historyHeading}
        </Text>
        <HistoryList history={history} onOpenMap={map.open} />
      </View>

      <AdRegion state={ads.state} revision={ads.revision} />

      {ads.privacyOptionsRequired ? (
        <PrivacyOptionsButton onPress={ads.openPrivacyOptions} />
      ) : null}

      <Link href="/info" style={styles.link}>
        {generatorText.infoLink}
      </Link>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, alignItems: "stretch" },
  brand: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  intro: { fontSize: 14, textAlign: "center", color: "#526B78" },
  result: { gap: 8, alignItems: "center", paddingVertical: 16 },
  resultHeading: { fontSize: 14, color: "#526B78" },
  postalCode: { fontSize: 36, fontWeight: "700" },
  address: { fontSize: 16, textAlign: "center", color: "#0F6E9E" },
  addressLink: { minHeight: 44, justifyContent: "center" },
  alert: {
    gap: 4,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FDECEC",
  },
  alertHeading: { fontSize: 16, fontWeight: "700", color: "#8A1C1C" },
  alertBody: { fontSize: 14, color: "#8A1C1C" },
  action: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: "#0F6E9E",
  },
  actionMuted: { opacity: 0.7 },
  actionLabel: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  section: { gap: 4 },
  sectionHeading: { fontSize: 16, fontWeight: "700" },
  history: { gap: 12 },
  entry: { gap: 2 },
  entryCode: { fontSize: 20, fontWeight: "700" },
  caption: { fontSize: 12, color: "#526B78" },
  link: { fontSize: 16, color: "#0F6E9E", textAlign: "center", minHeight: 48 },
});
