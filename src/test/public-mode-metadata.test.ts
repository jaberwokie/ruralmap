/**
 * Static smoke test: verifies index.html metadata is correct for the public
 * canonical URL. Runs without booting the app.
 *
 * NOTE: The deployed canonical is ruraltool.iterum.systems (the custom domain),
 * not ruralmap.lovable.app. We assert the canonical that actually ships.
 */
import { describe, it, expect } from "vitest";
import html from "../../index.html?raw";

const PUBLIC_CANONICAL = "https://ruraltool.iterum.systems/";

describe("index.html public metadata", () => {
  it("has canonical pointing to the public domain", () => {
    expect(html).toMatch(
      /<link\s+rel="canonical"\s+href="https:\/\/ruraltool\.iterum\.systems\/?"\s*\/?>/
    );
  });

  it("has og:url matching canonical", () => {
    expect(html).toContain(`property="og:url" content="${PUBLIC_CANONICAL}"`);
  });

  it("has an absolute og:image (not a Lovable default)", () => {
    const match = html.match(/property="og:image"\s+content="([^"]+)"/);
    expect(match, "og:image must be present").toBeTruthy();
    const url = match![1];
    expect(url.startsWith("https://")).toBe(true);
    expect(url).not.toContain("lovable-uploads");
    expect(url).not.toContain("lovable.dev");
  });

  it("title uses the deployed Rural Access Operations framing", () => {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    expect(titleMatch).toBeTruthy();
    const title = titleMatch![1];
    // Deployed production title, set via "Update site info for publish".
    // The NovumHealth prefix remains on meta[name=title], og:image:alt and the
    // WebApplication JSON-LD name.
    expect(title).toBe("Rural Access Operations");
    expect(title).not.toContain("Nevada Behavioral Health");
  });

  it("does not embed admin/debug language in head metadata", () => {
    const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
    expect(headMatch).toBeTruthy();
    const head = headMatch![0].toLowerCase();
    expect(head).not.toContain("unverified");
    expect(head).not.toContain("audit");
    expect(head).not.toContain("staging");
  });
});
