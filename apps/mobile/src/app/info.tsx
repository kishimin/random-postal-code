import { StyleSheet, Text, View } from "react-native";
import { formatPostalCode } from "../lib/postal-code-label";
import { mobileConfig } from "../config/env";

// A real entry of the committed dataset (〒100-0001, 東京都千代田区千代田),
// formatted through the shared contract rather than written out by hand.
const examplePostalCode = formatPostalCode("1000001");

/** The information route (Issue #12): what the app is and where data comes from. */
export default function InfoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.body}>
        Zipnamiは、日本の郵便番号をランダムに1つ表示するアプリです。
      </Text>
      <Text style={styles.body}>郵便番号の例: {examplePostalCode}</Text>
      <Text style={styles.caption}>
        郵便番号データは日本郵便株式会社が公開するデータを利用しています。
      </Text>
      <Text style={styles.caption}>
        API: {mobileConfig.apiBaseUrl ?? "未設定"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  body: { fontSize: 16 },
  caption: { fontSize: 12, color: "#526B78" },
});
