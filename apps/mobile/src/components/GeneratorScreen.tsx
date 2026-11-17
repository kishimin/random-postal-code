import type { PostalCode } from "@zipnami/shared";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useGenerator } from "../hooks/use-generator";
import type { GeneratorState } from "../lib/generator-state";
import { shownResultOf } from "../lib/generator-state";
import { generatorText } from "../lib/generator-text";
import { formatPostalCode } from "../lib/postal-code-label";

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

const CurrentResult = ({ result }: { result: PostalCode | undefined }) => {
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
          {result.addresses.map((address, index) => (
            // One postal code can list the same town twice in Japan Post's
            // data, so the position is part of the key.
            <Text
              key={`${index}:${address.prefecture}${address.city}${address.town}`}
              style={styles.address}
            >
              {`${address.prefecture}${address.city}${address.town}`}
            </Text>
          ))}
        </>
      )}
    </View>
  );
};

/**
 * The start route's content (Issue #13): generate a random postal code
 * from the Hono API and show it with every address.
 */
export const GeneratorScreen = () => {
  const { state, generate } = useGenerator();
  const loading = state.status === "loading";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={styles.brand}>
        {generatorText.brand}
      </Text>
      <Text style={styles.intro}>{generatorText.intro}</Text>

      <CurrentResult result={shownResultOf(state)} />

      {state.status === "error" ? (
        // `accessible` makes the alert one element, so TalkBack and
        // VoiceOver read the heading and the explanation together.
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={styles.alert}
        >
          <Text style={styles.alertHeading}>
            {generatorText.failureHeading}
          </Text>
          <Text style={styles.alertBody}>
            {generatorText.failure[state.failure]}
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled: loading }}
        disabled={loading}
        onPress={generate}
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
        <Text style={styles.caption}>{generatorText.historyEmpty}</Text>
      </View>

      {/* Reserved for the AdMob banner (Issue #15), outside every action. */}
      <View
        accessibilityLabel={generatorText.adRegionLabel}
        style={styles.banner}
      />

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
  address: { fontSize: 16, textAlign: "center" },
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
  caption: { fontSize: 12, color: "#526B78" },
  banner: { minHeight: 50 },
  link: { fontSize: 16, color: "#0F6E9E", textAlign: "center", minHeight: 48 },
});
