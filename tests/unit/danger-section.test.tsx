/**
 * DangerSectionRegion (the settings drawer's danger zone) — the delete-all
 * flow: arm → type the confirm word → confirm, against the REAL stack
 * (component → data layer → store → chrome-storage adapter) over the mocked
 * PLATFORM (helpers/danger-world.ts — import it FIRST).
 *
 * All state assertions read the STORAGE TRUTH (the mock's live data), not
 * the data layer's snapshot — snapshot refreshes are debounced and can be
 * silently dropped by the refreshing guard, so they are not authoritative.
 *
 * Regressions pinned here (v0.8.1):
 *  1. the confirm gate used to know ONLY «حذف» — typing "delete" left the
 *     confirm disabled with zero feedback (the reported "delete-all does
 *     nothing" bug);
 *  2. reset() used to leave the input value + confirm-enabled state stale.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { chromeMock, restoreSeed, recordHostsInTruth } from "./helpers/danger-world"; /* installs chrome — keep first */
import { setupDom } from "./helpers/engine";
import { createRoot } from "react-dom/client";
import { DangerSectionRegion, confirmWordOk } from "../../src/dashboard/components/PageChrome";
import * as data from "../../src/dashboard/data";

data.startData(); /* once-guarded: boots the real data layer against the mock */

beforeEach(() => {
  setupDom();
  restoreSeed();
});

const tick = () => new Promise((r) => setTimeout(r, 20));

/** Waits until cond() holds (storage writes drain asynchronously through
 *  the store's queue + the mocked chrome callbacks). */
async function until(cond: () => boolean, ms = 2000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) return;
    await new Promise((r) => setTimeout(r, 25));
  }
}

function mountDanger(): { host: HTMLElement; root: ReturnType<typeof createRoot> } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<DangerSectionRegion />);
  return { host, root };
}

function arm(host: HTMLElement): void {
  (host.querySelector("#danger-btn") as HTMLElement).click();
}

/* async on purpose: the enabled state is React state now (v0.8.1 fix), so a
   realistic "typed a word" includes the render flush before the next act */
async function typeWord(host: HTMLElement, word: string): Promise<void> {
  const input = host.querySelector("#danger-input") as HTMLInputElement;
  input.value = word;
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await tick();
}

function goBtn(host: HTMLElement): HTMLButtonElement {
  return host.querySelector("#danger-go") as HTMLButtonElement;
}

function toasts(): string[] {
  return [...document.querySelectorAll("#toasts .toast")].map((t) => t.textContent || "");
}

describe("منطقه‌ی خطر (DangerSectionRegion) — جریان حذف همه", () => {
  test("پیش‌نیاز: seed در سطح پلتفرم دو میزبان دارد", () => {
    expect(recordHostsInTruth().length).toBe(2);
  });

  test("آرم + کلمه‌ی «حذف» → دکمه‌ی تایید فعال می‌شود", async () => {
    const { host, root } = mountDanger();
    await tick();
    arm(host); await tick();
    await typeWord(host, "حذف");
    expect(goBtn(host).disabled).toBe(false);
    root.unmount();
  });

  test("باگ گزارش‌شده: آرم + تایپ delete (لاتین) → دکمه‌ی تایید فعال می‌شود", async () => {
    const { host, root } = mountDanger();
    await tick();
    arm(host); await tick();
    await typeWord(host, "delete");
    expect(goBtn(host).disabled).toBe(false);
    root.unmount();
  });

  test("حروف بزرگ/فاصله‌ی اضافه هم پذیرفته می‌شود (DELETE / « حذف »)", async () => {
    const { host, root } = mountDanger();
    await tick();
    arm(host); await tick();
    await typeWord(host, "  DELETE  ");
    expect(goBtn(host).disabled).toBe(false);
    root.unmount();
  });

  test("کلمه‌ی اشتباه → دکمه غیرفعال می‌ماند و هیچ حذفی رخ نمی‌دهد", async () => {
    const { host, root } = mountDanger();
    await tick();
    arm(host); await tick();
    await typeWord(host, "del");
    expect(goBtn(host).disabled).toBe(true);
    goBtn(host).click(); /* even a forced click must not delete */
    await tick();
    expect(recordHostsInTruth().length).toBe(2); /* untouched */
    root.unmount();
  });

  test("جریان کامل با «حذف»: حافظه‌ی واقعی خالی می‌شود، تنظیمات می‌ماند، toast موفق، ریست کامل", async () => {
    document.body.appendChild(Object.assign(document.createElement("div"), { id: "toasts" }));
    const { host, root } = mountDanger();
    await tick();
    arm(host); await tick();
    await typeWord(host, "حذف");
    goBtn(host).click();
    /* the storage truth: every hlx:d:* bucket gone; settings survive.
       clearAll wipes every hlx key and the settings restore is a SEPARATE
       queued write, so wait for it too — and for the post-reset render. */
    await until(() =>
      recordHostsInTruth().length === 0 &&
      !!chromeMock.__state.data["hlx:settings"] &&
      (host.querySelector("#danger-confirm") as HTMLElement).hidden
    );
    expect(recordHostsInTruth().length).toBe(0);
    expect(chromeMock.__state.data["hlx:settings"].theme).toBe("dark");
    /* the user-facing feedback */
    expect(toasts()).toContain("همه‌ی هایلایت‌ها و یادداشت‌ها حذف شد");
    /* full reset: disarmed, input cleared, confirm disabled again */
    expect(host.querySelector("#danger-confirm")).toHaveProperty("hidden", true);
    expect((host.querySelector("#danger-input") as HTMLInputElement).value).toBe("");
    expect(goBtn(host).disabled).toBe(true);
    root.unmount();
  });

  test("Enter با delete (لاتین) هم جریان را اجرا می‌کند", async () => {
    const { host, root } = mountDanger();
    await tick();
    arm(host); await tick();
    await typeWord(host, "delete");
    const input = host.querySelector("#danger-input") as HTMLInputElement;
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await until(() => recordHostsInTruth().length === 0);
    expect(recordHostsInTruth().length).toBe(0);
    root.unmount();
  });

  test("انصراف → ریست کامل (input خالی، دکمه‌ی تایید غیرفعال)", async () => {
    const { host, root } = mountDanger();
    await tick();
    arm(host); await tick();
    await typeWord(host, "حذف");
    (host.querySelector("#danger-cancel") as HTMLElement).click(); await tick();
    expect(host.querySelector("#danger-confirm")).toHaveProperty("hidden", true);
    expect((host.querySelector("#danger-input") as HTMLInputElement).value).toBe("");
    expect(goBtn(host).disabled).toBe(true);
    expect(recordHostsInTruth().length).toBe(2); /* untouched */
    root.unmount();
  });
});

describe("confirmWordOk — قانون واحد کلمه‌ی تایید", () => {
  test("«حذف» و delete (هر حالتی) قبول؛ بقیه رد", () => {
    expect(confirmWordOk("حذف")).toBe(true);
    expect(confirmWordOk("delete")).toBe(true);
    expect(confirmWordOk("DELETE")).toBe(true);
    expect(confirmWordOk(" Delete ")).toBe(true);
    expect(confirmWordOk(" حذف ")).toBe(true);
    expect(confirmWordOk("")).toBe(false);
    expect(confirmWordOk("   ")).toBe(false);
    expect(confirmWordOk("del")).toBe(false);
    expect(confirmWordOk("deletes")).toBe(false);
    expect(confirmWordOk("حذف کنید")).toBe(false);
    expect(confirmWordOk(undefined)).toBe(false);
    expect(confirmWordOk(null)).toBe(false);
  });
});
