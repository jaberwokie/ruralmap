import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// NOTE: Do NOT emit a static `dist/public.html` or `dist/public/index.html`
// to try to override metadata for the `/public` route. Lovable's static host
// treats a bare `dist/public` file as `application/octet-stream` (Safari
// downloads it instead of rendering), and a `dist/public/` directory does
// not auto-serve `index.html` for the extensionless `/public` URL. Lovable's
// built-in SPA fallback already serves `index.html` (text/html, 200) for
// `/public`, `/platform`, `/briefing`, etc. Per-route canonical/OG metadata
// must be handled inside the React app at runtime, not via build artifacts.

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    emitPublicRouteHtml(),
  ].filter(Boolean),
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
