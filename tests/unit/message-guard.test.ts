/**
 * Runtime message validation (hardening phase) — the parser both boundaries
 * run before acting on any inbound message. The malformed cases here are the
 * transport truth: whatever a compromised/broken peer puts on the wire, the
 * handler must never act on a guessed payload.
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

let HL: any;

beforeAll(async () => {
  setupDom();
  HL = await loadEngine({ files: ["shared/constants.js", "shared/message-guard.js"] });
});

const parse = (v: unknown) => HL.parseMessage(v);

describe("parseMessage — valid messages", () => {
  test("COUNT_REPORT with a sane count", () => {
    expect(parse({ type: "hlx:count-report", count: 3 })).toEqual({ type: "hlx:count-report", count: 3 });
    expect(parse({ type: "hlx:count-report", count: 0 })).toEqual({ type: "hlx:count-report", count: 0 });
  });
  test("GET_COUNT / HIGHLIGHT_SELECTION (payload-free)", () => {
    expect(parse({ type: "hlx:get-count" })).toEqual({ type: "hlx:get-count" });
    expect(parse({ type: "hlx:highlight-selection" })).toEqual({ type: "hlx:highlight-selection" });
  });
  test("GOTO with an engine-shaped id", () => {
    const id = "h.test~aGVsbG8";
    expect(parse({ type: "hlx:goto", id })).toEqual({ type: "hlx:goto", id });
  });
});

describe("parseMessage — malformed / hostile rejections", () => {
  test("null, undefined, primitives, arrays", () => {
    expect(parse(null)).toBeNull();
    expect(parse(undefined)).toBeNull();
    expect(parse(42)).toBeNull();
    expect(parse("hlx:get-count")).toBeNull();
    expect(parse([])).toBeNull();
  });
  test("unknown or missing discriminator → null (never guessed)", () => {
    expect(parse({ type: "hlx:evil" })).toBeNull();
    expect(parse({ type: "hlx:goto\x00", id: "x" })).toBeNull();
    expect(parse({})).toBeNull();
    expect(parse({ id: "x" })).toBeNull();
  });
  test("COUNT_REPORT: missing / wrong type / negative / non-finite / absurd", () => {
    expect(parse({ type: "hlx:count-report" })).toBeNull();
    expect(parse({ type: "hlx:count-report", count: "3" })).toBeNull();
    expect(parse({ type: "hlx:count-report", count: -1 })).toBeNull();
    expect(parse({ type: "hlx:count-report", count: Infinity })).toBeNull();
    expect(parse({ type: "hlx:count-report", count: NaN })).toBeNull();
    expect(parse({ type: "hlx:count-report", count: 1e12 })).toBeNull();
  });
  test("GOTO: missing / wrong type / empty / oversized / control-char ids", () => {
    expect(parse({ type: "hlx:goto" })).toBeNull();
    expect(parse({ type: "hlx:goto", id: 42 })).toBeNull();
    expect(parse({ type: "hlx:goto", id: "" })).toBeNull();
    expect(parse({ type: "hlx:goto", id: "x".repeat(201) })).toBeNull();
    expect(parse({ type: "hlx:goto", id: "bad\nid" })).toBeNull();
  });
  test("extra fields on a payload are IGNORED (not trusted, not fatal)", () => {
    expect(parse({ type: "hlx:get-count", extra: { evil: true } })).toEqual({ type: "hlx:get-count" });
    expect(parse({ type: "hlx:count-report", count: 1, url: "javascript:alert(1)" })).toEqual({ type: "hlx:count-report", count: 1 });
  });
});
