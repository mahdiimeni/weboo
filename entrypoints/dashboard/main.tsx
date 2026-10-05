/**
 * Phase 8 Task 4 — switchover bridge + React mount.
 *
 * Two owners share the page during the transition:
 *  1. the imperative controller (dashboard.js) boots as a side-effect import
 *     and keeps every NOT-yet-ported region (list, modals, settings…);
 *  2. React mounts into the static shell regions ported slice-by-slice —
 *     slice 1: the stats strip. createRoot replaces the host's children with
 *     byte-equal markup (ids/classes are load-bearing contracts).
 *
 * Task 5 retires the controller when the last region lands.
 */
import { createRoot } from "react-dom/client";
import "../../extension/dashboard/dashboard.js";
import { App } from "../../src/dashboard/App";

const statsHost = document.querySelector(".stats");
if (statsHost) createRoot(statsHost).render(<App />);
