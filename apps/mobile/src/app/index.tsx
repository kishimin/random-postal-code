import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

/**
 * The start route. The random postal-code experience itself is Issue #13;
 * this foundation (Issue #12) only gives it a place and links the
 * information route.
 */
export default function StartScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ZIPNAMI</Text>
      <Link href="/info" style={styles.link}>
        Zipnami について
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  title: { fontSize: 24, fontWeight: "700" },
  link: { fontSize: 16, color: "#0F6E9E" },
});
