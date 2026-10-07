/**
 * Runtime ↔ type contract parity (modernization Phase 1).
 *
 * The `src/types/*` files document and type-check the contracts that the
 * classic-script runtime actually implements. This suite pins the two
 * together: if HL.MSG, HL.DEFAULT_SETTINGS, the port member list, or the
 * record shapes drift away from the types, the suite (or `bun run
 * typecheck`) goes red — never silently.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";
import type { HighlightRecord, HighlightAnchor } from "../../src/types/highlight";
import type { Settings } from "../../src/types/settings";
import type { StorageBackend as PortBackend, BackupSelection as PortSelection } from "../../src/types/storage";
import type { StorageBackend as MirrorBackend, BackupSelection as MirrorSelection } from "../../src/shared/store"; /* aliased: store.ts cannot import src/types (rootDir src/shared), so it keeps a duplicate port — the assignability test below is the drift tripwire */
import {
  EXTENSION_MESSAGE_TYPES,
  type ExtensionMessage,
  type MessageResponse,
} from "../../src/types/messaging";

describe("types ↔ runtime contract parity (Phase 1)", () => {
  let HL: any;
  beforeEach(async () => { setupDom(); HL = await loadEngine({}); });

  test("HL.MSG values == typed message union (exact set)", () => {
    const runtime = Object.values(HL.MSG).slice().sort();
    const typed = EXTENSION_MESSAGE_TYPES.slice().sort();
    expect(runtime).toEqual(typed);
  });

  test("typed messages/ responses construct per contract", () => {
    const goto: ExtensionMessage = { type: "hlx:goto", id: "r1" };
    const report: ExtensionMessage = { type: "hlx:count-report", count: 3 };
    const bare: ExtensionMessage = { type: "hlx:get-count" };
    const resp: MessageResponse<"hlx:goto"> = { ok: true };
    const countResp: MessageResponse<"hlx:get-count"> = { count: 7 };
    expect([goto.type, report.count, bare.type, resp.ok, countResp.count])
      .toEqual(["hlx:goto", 3, "hlx:get-count", true, 7]);
    // @ts-expect-error — payload-free message must not carry a payload
    const illegal: ExtensionMessage = { type: "hlx:get-count", count: 1 };
    expect(illegal.type).toBe("hlx:get-count");
  });

  test("DEFAULT_SETTINGS satisfies the Settings type (registries in sync)", () => {
    const s: Settings = { ...HL.DEFAULT_SETTINGS };
    expect(HL.COLOR_KEYS).toContain(s.defaultColor);
    expect(HL.THEME_KEYS).toContain(s.theme);
    expect(Array.isArray(s.disabledHosts)).toBe(true);
    expect(typeof s.showToolbar).toBe("boolean");
    expect(typeof s.showBadge).toBe("boolean");
  });

  test("record shapes: full engine literal + persisted core are both HighlightRecord", () => {
    const anchor: HighlightAnchor = {
      start: "/html/body/p[1]", startOffset: 4,
      end: "/html/body/p[1]", endOffset: 16,
    };
    const full: HighlightRecord = {
      id: "r1", host: "h.test", url: "https://h.test/a", urlNorm: "https://h.test/a",
      text: "quoted text", createdAt: 1, updatedAt: 2,
      site: "h.test", title: "Article", prefix: "pre ", suffix: " suf",
      start: 10, end: 22, anchor, color: "green", note: "",
    };
    const minimal: HighlightRecord = { /* store.test.ts's persisted core */
      id: "r2", host: "h", url: "u", urlNorm: "n", text: "t", createdAt: 1, updatedAt: 2,
    };
    const noAnchor: HighlightRecord = { ...minimal, anchor: null };
    expect([full.color, minimal.id, noAnchor.anchor]).toEqual(["green", "r2", null]);
    // @ts-expect-error — color must be a registry key
    const bad: HighlightRecord = { ...minimal, color: "orange" };
    expect((bad as { color?: string }).color).toBe("orange");
  });

  test("port mirror: store.ts mirror ⇄ src/types/storage.ts (compile-time)", () => {
    /* src/shared/store.ts cannot import src/types (tsc rootDir is src/shared),
       so it duplicates the port and EXPORTS the mirror type (7c-2 made the file
       a module; the old script-era global name is gone). Both directions must
       be assignable or `bun run typecheck` fails — the two can never drift. */
    const mirrorToPort: PortBackend = null as unknown as MirrorBackend;
    const portToMirror: MirrorBackend = null as unknown as PortBackend;
    expect(typeof mirrorToPort).toBe("object"); /* the assignability itself is compile-time */
    expect(typeof portToMirror).toBe("object");
  });

  test("selection mirror: BackupSelection — store.ts mirror ⇄ src/types/storage.ts (compile-time)", () => {
    /* the selective backup's criteria contract rides the same mirror pattern
       as the port: both directions assignable, so the two can never drift */
    const mirrorToPort: PortSelection = null as unknown as MirrorSelection;
    const portToMirror: MirrorSelection = null as unknown as PortSelection;
    expect(typeof mirrorToPort).toBe("object");
    expect(typeof portToMirror).toBe("object");
    /* the contract's members exist on both sides (structural, optional) */
    const sel: PortSelection = { hosts: ["a.com"], articles: [], tags: ["ت"] };
    expect([...sel.hosts!, ...sel.articles!, ...sel.tags!]).toEqual(["a.com", "ت"]);
  });

  test("matcher runtime: HL.matchesBackupSelection is the exported pure predicate", () => {
    expect(typeof HL.matchesBackupSelection).toBe("function");
    const r = { id: "r", host: "h.io", url: "https://h.io/p", urlNorm: "https://h.io/p" };
    expect(HL.matchesBackupSelection(r, { hosts: ["h.io"] }, {})).toBe(true);
    expect(HL.matchesBackupSelection(r, { tags: ["x"] }, {})).toBe(false); /* article has no tags */
  });

  test("port ISP: memory backend exposes exactly the 5 contract members", () => {
    const m = HL.backends.memoryArea();
    expect(Object.keys(m).sort()).toEqual(["bytes", "get", "onChange", "remove", "set"]);
    /* the shape is assignable to the port type (compile-time, verified by typecheck) */
    const port: PortBackend = m;
    expect(typeof port.get).toBe("function");
  });
});
