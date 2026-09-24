import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.rotafrota.app",
  appName: "RotaFrota",
  webDir: "dist",
  backgroundColor: "#142e2b",
  loggingBehavior: "debug",
  android: { allowMixedContent: false },
  ios: { contentInset: "automatic" },
};
export default config;
