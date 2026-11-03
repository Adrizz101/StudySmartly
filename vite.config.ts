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
      strategies: "generate-sw",
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
      generateSW: {
        swDest: "sw.js",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}"],
        navigateFallback: "/",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" &&
              url.origin === self.location.origin &&
              !url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "study-pages",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin &&
              ["script", "style", "font", "image"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "study-static-assets",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "study-google-fonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
