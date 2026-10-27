import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
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
    // Use src/server.ts (SSR error wrapper) as the server entry.
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    viteReact(),
    tailwindcss(),
  ],
});
