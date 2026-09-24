import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE_PATH || "./",
    plugins: [
      react(),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
        manifest: {
          name: "RotaFrota — Controle de frotas",
          short_name: "RotaFrota",
          description: "Viagens e abastecimentos da sua frota.",
          lang: "pt-BR",
          theme_color: "#142e2b",
          background_color: "#f4f6f8",
          display: "standalone",
          start_url: "./",
          scope: "./",
          icons: [
            {
              src: "icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          navigateFallback: "index.html",
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    server: { port: 5173, strictPort: true },
  };
});
