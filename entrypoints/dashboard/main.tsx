/**
 * Phase 8 Task 4 — switchover bridge + React mounts.
 *
 * Two owners share the page during the transition:
 *  1. the imperative controller (dashboard.js) boots as a side-effect import
 *     and keeps every NOT-yet-ported region (list, modals, drawer, theme…);
 *  2. React owns the ported regions slice-by-slice — one createRoot per
 *     region host (createRoot takes over the host's children; the markup
 *     contract is byte-equal, ids/classes are load-bearing).
 *
 * Data: data.ts starts once (store instance + subscriptions) and feeds the
 * region roots via useSyncExternalStore.
 *
 * Slices ported: 1 (stats) · 2 (hosts) · 3 (bulk) · 7 (settings) · 6
 * (empty/load-more) · 4 (toolbar + the whole list). Since slice 4 the
 * controller holds no list state and renders no list DOM.
 */
import { createRoot } from "react-dom/client";
import "../../extension/dashboard/dashboard.js";
import { StatsRegion, HostsRegion, BulkRegion, ThemeRegion, DotsRegion, SwitchesRegion, EmptyRegion, MoreRegion, ToolbarRegion, ListRegion } from "../../src/dashboard/App";
import { startData } from "../../src/dashboard/data";

startData();

const mounts: Array<[Element, React.ReactElement]> = [];

const statsHost = document.querySelector(".stats");
if (statsHost) mounts.push([statsHost, <StatsRegion />]);

const hostsHost = document.getElementById("host-chips")?.closest(".set-sec");
if (hostsHost) mounts.push([hostsHost, <HostsRegion />]);

const bulkHost = document.querySelector(".list-bar");
if (bulkHost) mounts.push([bulkHost, <BulkRegion />]);

const themeHost = document.getElementById("theme-radios")?.closest(".set-sec");
if (themeHost) mounts.push([themeHost, <ThemeRegion />]);

const dotsHost = document.getElementById("color-dots")?.closest(".set-sec");
if (dotsHost) mounts.push([dotsHost, <DotsRegion />]);

const switchesHost = document.getElementById("set-toolbar")?.closest(".set-sec");
if (switchesHost) mounts.push([switchesHost, <SwitchesRegion />]);

const toolbarHost = document.querySelector(".toolbar");
if (toolbarHost) mounts.push([toolbarHost, <ToolbarRegion />]);

const groupsHost = document.getElementById("groups");
if (groupsHost) mounts.push([groupsHost, <ListRegion />]);

const emptyHost = document.getElementById("empty-host");
if (emptyHost) mounts.push([emptyHost, <EmptyRegion />]);

const moreHost = document.getElementById("load-more-host");
if (moreHost) mounts.push([moreHost, <MoreRegion />]);

mounts.forEach(([host, el]) => { createRoot(host).render(el); });
