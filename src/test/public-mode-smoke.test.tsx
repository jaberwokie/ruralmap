/**
 * Public Sharing mode smoke test.
 *
 * Boots the App with `?public=1` in jsdom and asserts:
 *  - No admin UI / admin badge
 *  - No build/version/debug fingerprint in DOM
 *  - No internal terms (verification, audit, claims, unverified, staging,
 *    pipeline, attributed, penetration, encounters, promote, unmapped)
 *
 * The map itself doesn't render meaningfully in jsdom (no layout), but the
 * App shell, sidebar text, and gating logic do — which is what we care about.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import App from "@/App";

const FORBIDDEN_TERMS = [
  "unverified",
  "verification",
  "audit",
  "staging",
  "pipeline",
  "claims",
  "attributed",
  "penetration",
  "encounters",
  "promote",
  "unmapped",
];

const ADMIN_HINTS = [
  "admin",
  "build ",       // BuildFingerprint label format: "build {id} • {date}"
  "version",      // AdminVersionBadge label includes "v{n}"
  "fingerprint",
];

describe("Public Sharing mode (/public) smoke", () => {
  beforeAll(() => {
    // Set URL before App mounts — usePublicSafeMode reads window.location.pathname
    window.history.replaceState({}, "", "/public");
  });

  afterAll(() => {
    window.history.replaceState({}, "", "/");
    cleanup();
  });

  it("renders without throwing under /public", () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it("does not render the BuildFingerprint element", () => {
    const { container } = render(<App />);
    expect(container.querySelector("[data-build-id]")).toBeNull();
  });

  it("does not leak internal terminology in visible text", () => {
    const { container } = render(<App />);
    const text = (container.textContent || "").toLowerCase();
    const leaked = FORBIDDEN_TERMS.filter((term) => text.includes(term));
    expect(
      leaked,
      `Forbidden terms found in public-mode DOM: ${leaked.join(", ")}`
    ).toEqual([]);
  });

  it("does not leak admin/debug labels in visible text", () => {
    const { container } = render(<App />);
    const text = (container.textContent || "").toLowerCase();
    const leaked = ADMIN_HINTS.filter((term) => text.includes(term));
    expect(
      leaked,
      `Admin/debug hints found in public-mode DOM: ${leaked.join(", ")}`
    ).toEqual([]);
  });
});
