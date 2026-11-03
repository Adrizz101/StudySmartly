import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { TanStackNitroPWAPlugin } from "@vite-pwa/tanstack/vite/nitro";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
  },
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  plugins: [
    tsConfigPaths(),
    // Prerender the public app shell so the PWA has a safe offline entry point.
    nitro({
      baseURL: "/",
      routeRules: {
        "/": { prerender: true },
      },
    }),
    tanstackStart({
      server: { entry: "server" },
      prerender: { enabled: true },
    }),
    viteReact(),
    tailwindcss(),
    // TanStack Start + Nitro needs its dedicated integration: the plain VitePWA
    // build hook is skipped by this framework's SSR client build.
    TanStackNitroPWAPlugin({
      registerType: "autoUpdate",
      strategies: "inject-manifest",
      includeAssets: ["favicon.jpg", "logo.jpg"],
      manifest: {
        name: "StudySmartly",
        short_name: "StudySmartly",
        description: "The 100% free AI-powered visual study platform.",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/favicon.jpg",
            sizes: "192x192",
            type: "image/jpeg",
            purpose: "any",
          },
          {
            src: "/favicon.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "any",
          },
          {
            src: "/logo.jpg",
            sizes: "any",
            type: "image/jpeg",
            purpose: "any",
          },
        ],
      },
      injectManifest: {
        swSrc: "src/sw.js",
        swDest: "sw.js",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      }
    }),
  ],
});
