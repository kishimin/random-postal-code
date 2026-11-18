import { Pressable, StyleSheet, Text } from "react-native";
import { generatorText } from "../lib/generator-text";

/**
 * The entry point to the ad privacy-options form (Issue #146). The caller
 * shows it only where the SDK requires privacy options.
 * @param {object} props - The component props.
 * @param {() => void} props.onPress - Opens the form.
 */
export const PrivacyOptionsButton = ({ onPress }: { onPress: () => void }) => (
  <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
    <Text style={styles.label}>{generatorText.privacyOptionsAction}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: { minHeight: 48, justifyContent: "center" },
  label: { fontSize: 16, color: "#0F6E9E", textAlign: "center" },
});
