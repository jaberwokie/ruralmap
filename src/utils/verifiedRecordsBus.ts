/**
 * Cross-tab + same-tab refresh bus for verified Service / BH records.
 *
 * Lives in its own module (no React) so Fast Refresh treats the hook file
 * as a pure component module. Exports:
 *   - VERIFIED_RECORDS_CHANGED_EVENT — same-tab window event name
 *   - notifyVerifiedRecordsChanged() — fire same-tab + cross-tab signal
 *   - subscribeVerifiedRecordsChanged(cb) — subscribe to both transports
 *
 * Cross-tab uses BroadcastChannel (same browser/profile only). Cross-browser
 * / cross-user / cross-device sync is NOT supported here.
 */

export const VERIFIED_RECORDS_CHANGED_EVENT = 'verified-records-changed';
const BROADCAST_CHANNEL_NAME = 'verified-records-changed';

let sharedChannel: BroadcastChannel | null = null;
const getChannel = (): BroadcastChannel | null => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!sharedChannel) {
    try { sharedChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME); }
    catch { sharedChannel = null; }
  }
  return sharedChannel;
};

export const notifyVerifiedRecordsChanged = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(VERIFIED_RECORDS_CHANGED_EVENT));
  try { getChannel()?.postMessage({ type: 'changed', at: Date.now() }); } catch { /* noop */ }
};

export const subscribeVerifiedRecordsChanged = (cb: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const winHandler = () => cb();
  window.addEventListener(VERIFIED_RECORDS_CHANGED_EVENT, winHandler);

  const ch = getChannel();
  const chHandler = () => cb();
  ch?.addEventListener('message', chHandler);

  return () => {
    window.removeEventListener(VERIFIED_RECORDS_CHANGED_EVENT, winHandler);
    ch?.removeEventListener('message', chHandler);
  };
};
