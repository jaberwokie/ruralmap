/**
 * Unreviewed legacy resource pins may be used only for deliberate local
 * engineering evaluation. They must never silently appear in a production
 * Winged Wolf build when the independent database is empty.
 */
export function allowLegacyStaticPreview(isDevelopment: boolean, explicitOptIn?: string): boolean {
  return isDevelopment && explicitOptIn === 'true';
}
