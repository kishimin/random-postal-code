import { Stack } from "expo-router";

/** The app's root navigator: one stack, Expo Router's file-based routes. */
export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Zipnami" }} />
      <Stack.Screen name="info" options={{ title: "Zipnami について" }} />
    </Stack>
  );
}
