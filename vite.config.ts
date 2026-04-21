import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  define: {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION ?? ''),
    // No-op unique build id — guarantees each build produces a distinct artifact
    // so the publish dialog always detects a deployable change.
    __APP_BUILD_ID__: JSON.stringify(
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
