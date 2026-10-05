/**
 * Phase 8 Task 5 — the page's imperative chrome: the settings drawer frame.
 *
 * The drawer's SECTIONS are React regions (mounted into hosts inside the
 * static aside); the frame itself (open/close classes, aria, Escape, the
 * #hlx-settings deep-link, focus handoff) is genuinely imperative UI over
 * the static shell — a small module instead of a retired controller. It
 * follows the drawerOpen session state (data.ts) and keeps the controller's
 * exact behaviors: focus lands on the close button when opened, the hash is
 * cleared after a deep-link use, Escape closes an open drawer.
 */
import { getData, subscribeData, setDrawerOpen } from "./data";

const SETTINGS_HASH_OPEN = "#hlx-settings";

export function initDrawerChrome(): void {
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("overlay");
  const drawerClose = document.getElementById("drawer-close");
  const btnSettings = document.getElementById("btn-settings");
  if (!drawer || !overlay) return;

  function apply(open: boolean) {
    drawer!.classList.toggle("open", open);
    overlay!.classList.toggle("show", open);
    drawer!.setAttribute("aria-hidden", String(!open));
    if (open) {
      try { drawerClose?.focus(); } catch (e) { /* noop */ }
    }
  }
  apply(getData().drawerOpen);
  subscribeData(() => apply(getData().drawerOpen));

  btnSettings?.addEventListener("click", () => setDrawerOpen(true));
  drawerClose?.addEventListener("click", () => setDrawerOpen(false));
  overlay.addEventListener("click", () => setDrawerOpen(false));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && getData().drawerOpen) setDrawerOpen(false);
  });

  /* Settings panel deep-link (#hlx-settings from the popup's gear button) —
     the hash is cleared after use so a later reload doesn't reopen the drawer. */
  function checkSettingsHash() {
    if ((location.hash || "") !== SETTINGS_HASH_OPEN) return;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* noop */ }
    setDrawerOpen(true);
  }
  checkSettingsHash();
  window.addEventListener("hashchange", checkSettingsHash);
}
