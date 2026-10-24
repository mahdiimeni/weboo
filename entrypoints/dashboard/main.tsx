/**
 * Phase 8 Task 4 — switchover bridge + React mounts.
 *
 * Phase 8 Task 5 — the controller is RETIRED: React owns every region (one
 * createRoot per region host; createRoot takes over the host's children —
 * the markup contracts are byte-equal, ids/classes are load-bearing), the
 * drawer frame chrome lives in chrome.ts (imperative over the static shell),
 * and data.ts is the single data + action layer.
 *
 * Ported: 1 (stats) · 2 (hosts) · 3 (bulk) · 7 (settings) · 6
 * (empty/load-more) · 4 (toolbar + list) · 5 (modals) · Task 5 (topbar,
 * restore/drawer sections, danger zone).
 */
import { createRoot } from "react-dom/client";
import { StatsRegion, HostsRegion, BulkRegion, ThemeRegion, DotsRegion, SwitchesRegion, EmptyRegion, MoreRegion, ToolbarRegion, ListRegion, PreviewModalRegion, RestoreModalRegion, BookletModalRegion, BackupModalRegion, TopbarActionsRegion, RestoreSectionRegion, DangerSectionRegion } from "../../src/dashboard/App";
import { startData } from "../../src/dashboard/data";
import { initDrawerChrome } from "../../src/dashboard/chrome";

startData();
initDrawerChrome();

const mounts: Array<[Element, React.ReactElement]> = [];

const statsHost = document.querySelector(".stats");
if (statsHost) mounts.push([statsHost, <StatsRegion />]);

const hostsHost = document.getElementById("host-chips")?.closest(".set-sec");
if (hostsHost) mounts.push([hostsHost, <HostsRegion />]);

const bulkHost = document.querySelector(".list-bar");
if (bulkHost) mounts.push([bulkHost, <BulkRegion />]);

/* The three settings regions mount into their INNER hosts (not the
   .set-sec section): createRoot takes over the host's children, so a
   section-level mount erased the shell's h3 headings and the .color-dots
   flex wrapper — the bare dots then stacked as rows of the column-flex
   section (v0.8.2 regression). The shell owns the section chrome. */
const themeHost = document.getElementById("theme-radios");
if (themeHost) mounts.push([themeHost, <ThemeRegion />]);

const dotsHost = document.getElementById("color-dots");
if (dotsHost) mounts.push([dotsHost, <DotsRegion />]);

const switchesHost = document.getElementById("behavior-host");
if (switchesHost) mounts.push([switchesHost, <SwitchesRegion />]);

const toolbarHost = document.querySelector(".toolbar");
if (toolbarHost) mounts.push([toolbarHost, <ToolbarRegion />]);

const groupsHost = document.getElementById("groups");
if (groupsHost) mounts.push([groupsHost, <ListRegion />]);

const emptyHost = document.getElementById("empty-host");
if (emptyHost) mounts.push([emptyHost, <EmptyRegion />]);

const moreHost = document.getElementById("load-more-host");
if (moreHost) mounts.push([moreHost, <MoreRegion />]);

const hlModalHost = document.getElementById("hl-modal-host");
if (hlModalHost) mounts.push([hlModalHost, <PreviewModalRegion />]);

const restoreModalHost = document.getElementById("restore-modal-host");
if (restoreModalHost) mounts.push([restoreModalHost, <RestoreModalRegion />]);

const bookletModalHost = document.getElementById("booklet-modal-host");
if (bookletModalHost) mounts.push([bookletModalHost, <BookletModalRegion />]);

const backupModalHost = document.getElementById("backup-modal-host");
if (backupModalHost) mounts.push([backupModalHost, <BackupModalRegion />]);

const topbarHost = document.querySelector(".topbar-actions");
if (topbarHost) mounts.push([topbarHost, <TopbarActionsRegion />]);

const restoreSecHost = document.getElementById("restore-sec-host");
if (restoreSecHost) mounts.push([restoreSecHost, <RestoreSectionRegion />]);

const dangerSecHost = document.getElementById("danger-sec-host");
if (dangerSecHost) mounts.push([dangerSecHost, <DangerSectionRegion />]);

mounts.forEach(([host, el]) => { createRoot(host).render(el); });
