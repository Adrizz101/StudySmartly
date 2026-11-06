import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { TanStackNitroPWAPlugin } from "@vite-pwa/tanstack/vite/nitro";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
  },
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
    // Alias only exact Node built-in specifiers. In particular, the exact
    // match leaves node:stream/promises native for Nitro's server adapter.
    alias: [
      { find: /^node:crypto$/, replacement: "crypto" },
      { find: /^node:stream$/, replacement: "stream" },
      { find: /^node:vm$/, replacement: "vm" },
      { find: /^node:path$/, replacement: "path" },
      { find: /^node:buffer$/, replacement: "buffer" },
      { find: /^node:process$/, replacement: "process" },
    ],
  },
  plugins: [
    // OpenMAIC needs Node built-ins in the browser bundle.
    nodePolyfills({
      include: ['crypto', 'stream', 'vm', 'path', 'buffer', 'process'],
      globals: { Buffer: true, global: true, process: true },
      // Keep Node protocol subpaths such as node:stream/promises native.
      protocolImports: false,
    }),
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
      strategies: "build-sw",
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
      buildSW: {
        swSrc: "src/sw.js",
        swDest: "sw.js",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      }
    }),
  ],
});
