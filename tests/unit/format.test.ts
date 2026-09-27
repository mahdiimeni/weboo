/**
 * HL.format tests — display formats (the v0.6.0 additions: fmtDate, isoDate, oneLine)
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

let HL: any;

beforeEach(() => {
  setupDom();
  HL = loadEngine({ files: ["shared/constants.js", "shared/format.js"] });
});

/* 2024-10-27 12:00 UTC — noon UTC keeps the calendar day stable across every
   realistic runner timezone (±11h around UTC all see the same date) */
const NOON = Date.UTC(2024, 9, 27, 12);

describe("HL.format.fmtDate", () => {
  test("قرارداد: تاریخ کوتاه فارسی بدون ساعت", () => {
    const out = HL.format.fmtDate(NOON);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(3);
    expect(out).not.toContain(":"); /* fmtDateTime carries a time — fmtDate never does */
    expect(/[\u06F0-\u06F9]/.test(out)).toBe(true); /* Persian digits */
  });

  test("مقدار نامعتبر → رشته‌ی خالی (نه خطا) — هم‌قرارداد fmtDateTime", () => {
    expect(HL.format.fmtDate(undefined)).toBe("");
    expect(HL.format.fmtDate(NaN)).toBe("");
    /* null → epoch 0 — تاریخ معتبر است، دقیقاً مثل fmtDateTime (LSP بین توابع فرمت) */
    expect(typeof HL.format.fmtDate(null)).toBe("string");
    expect(HL.format.fmtDate(null).length).toBeGreaterThan(0);
  });
});

describe("HL.format.isoDate", () => {
  test("YYYY-MM-DD برای ظهر UTC پایدار", () => {
    expect(HL.format.isoDate(NOON)).toBe("2024-10-27");
  });

  test("دو رقمی بودن ماه و روز", () => {
    const d = Date.UTC(2025, 0, 5, 12);
    expect(HL.format.isoDate(d)).toBe("2025-01-05");
  });

  test("مقدار نامعتبر → رشته‌ی خالی؛ null → epoch (معتبر)", () => {
    expect(HL.format.isoDate(undefined)).toBe("");
    expect(HL.format.isoDate(NaN)).toBe("");
    expect(HL.format.isoDate(null)).toBe("1970-01-01");
  });
});

describe("HL.format.oneLine", () => {
  test("همه‌ی انواع فاصله را به یک فاصله‌ی تکی جمع می‌کند", () => {
    expect(HL.format.oneLine("a\n\n b   c ")).toBe("a b c");
    expect(HL.format.oneLine("سلام\r\n\r\nدنیا\t\tب")).toBe("سلام دنیا ب");
  });

  test("null/undefined → رشته‌ی خالی؛ عدد → رشته", () => {
    expect(HL.format.oneLine(null)).toBe("");
    expect(HL.format.oneLine(undefined)).toBe("");
    expect(HL.format.oneLine(5)).toBe("5");
  });

  test("متن تک‌خطی بدون تغییر (idempotent)", () => {
    expect(HL.format.oneLine("متن ساده")).toBe("متن ساده");
    expect(HL.format.oneLine(HL.format.oneLine("a  b\n c"))).toBe(HL.format.oneLine("a  b\n c"));
  });
});
