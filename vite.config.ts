import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

const PUBLIC_CANONICAL = "https://ruralmap.opsframe.io/public";

/**
 * Emit a route-specific static HTML file at `dist/public` so that
 * crawlers (LinkedIn, Twitter, etc.) hitting `/public` receive a canonical /
 * og:url / twitter:url pointing at `/public` instead of inheriting the root
 * SPA fallback's canonical. Same SPA bootstrap; metadata is the only diff.
 */
const emitPublicRouteHtml = (): Plugin => ({
  name: "emit-public-route-html",
  apply: "build",
  configResolved(config) {
    this.publicRouteOutDir = path.resolve(config.root, config.build.outDir);
  },
  closeBundle() {
    const distDir = this.publicRouteOutDir ?? path.resolve(__dirname, "dist");
    const rootHtml = path.join(distDir, "index.html");
    if (!fs.existsSync(rootHtml)) return;
    let html = fs.readFileSync(rootHtml, "utf8");

    // Rewrite canonical
    html = html.replace(
      /<link\s+rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${PUBLIC_CANONICAL}" />`
    );
    // Rewrite og:url
    html = html.replace(
      /<meta\s+property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${PUBLIC_CANONICAL}" />`
    );
    // Rewrite twitter:url
    html = html.replace(
      /<meta\s+name="twitter:url"[^>]*>/i,
      `<meta name="twitter:url" content="${PUBLIC_CANONICAL}" />`
    );

    // Emit dist/public/index.html so the static host serves it for `/public`
    // requests. Do NOT delete the dist/public directory — Vite copies the
    // source `public/` assets (data/, og-image.jpg, favicons, etc.) there and
    // wiping it breaks runtime fetches and the OG image, which is what was
    // causing `/public` to fail (500) for crawlers.
    const publicRouteDir = path.join(distDir, "public");
    if (fs.existsSync(publicRouteDir) && !fs.statSync(publicRouteDir).isDirectory()) {
      fs.rmSync(publicRouteDir, { force: true });
    }
    fs.mkdirSync(publicRouteDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, "public.html"), html, "utf8");
    fs.writeFileSync(path.join(publicRouteDir, "index.html"), html, "utf8");
  },
});

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
