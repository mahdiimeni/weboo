/**
 * React component tests (Phase 8 Task 4) — bun:test + happy-dom.
 *
 * Plan Step 0 spike: bun transpiles .tsx natively (tsconfig jsx: react-jsx)
 * and react-dom/client mounts into the happy-dom document installed by
 * setupDom — the same fresh-world-per-test pattern the view tests use.
 * Components under test render the SAME markup the retired builders wrote
 * (ids/classes are load-bearing: the controller and E2E smokes query them).
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom } from "./helpers/engine";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { StatsStrip } from "../../src/dashboard/components/StatsStrip";
import { DisabledHosts } from "../../src/dashboard/components/DisabledHosts";
import { BulkToggle } from "../../src/dashboard/components/BulkToggle";
import { THEME_KEYS, THEMES, COLORS } from "../../extension/shared/constants.js";
import { BULK_ACTION_META } from "../../src/dashboard/components/BulkToggle";
import { THEME_HINTS } from "../../src/dashboard/components/ThemeRadios";
import { ThemeRadios } from "../../src/dashboard/components/ThemeRadios";
import { ColorDots } from "../../src/dashboard/components/ColorDots";
import { BehaviorSwitches } from "../../src/dashboard/components/BehaviorSwitches";
import { EmptyState } from "../../src/dashboard/components/EmptyState";
import { PreviewModal, RestoreModal, BookletModal, BackupModal } from "../../src/dashboard/components/Modals";
import type { BookletFontId, BookletBuildOptions } from "../../src/types/booklet";
import { LoadMore } from "../../src/dashboard/components/LoadMore";
import { dash } from "../../extension/dashboard/dashboard-data.js";

beforeEach(() => { setupDom(); });

const tick = () => new Promise((r) => setTimeout(r, 20));

function mount(jsx: any, hostEl?: HTMLElement): { host: HTMLElement; root: ReturnType<typeof createRoot> } {
  const host = hostEl ?? document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(jsx);
  return { host, root };
}

describe("سpike: bun + tsx + happy-dom + react-dom/client", () => {
  test("createRoot mounts and unmounts into the happy-dom document", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(createElement("b", { className: "x" }, "salam"));
    await new Promise((r) => setTimeout(r, 20));
    expect(host.querySelector("b.x")?.textContent).toBe("salam");
    root.render(createElement("i", null, "khoob"));
    await new Promise((r) => setTimeout(r, 20));
    expect(host.querySelector("i")?.textContent).toBe("khoob");
    root.unmount();
    expect(host.querySelector("b.x")).toBeNull();
  });
});

describe("StatsStrip (Phase 8 slice 1)", () => {
  test("four stat cards — same DOM contract the static shell + controller wrote", async () => {
    const host = document.createElement("section");
    host.className = "stats";
    host.setAttribute("aria-label", "آمار کلی");
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<StatsStrip stats={{ total: 12, notes: 3, pages: 5, sites: 4 }} />);
    await tick();

    expect(host.querySelectorAll(".stat-card").length).toBe(4);
    expect(host.querySelector("#st-total .stat-num, .stat-card")?.textContent).toBeTruthy();
    const ids = ["st-total", "st-notes", "st-pages", "st-sites"];
    const values = [12, 3, 5, 4];
    const labels = ["کل هایلایت‌ها", "یادداشت‌ها", "صفحات", "سایت‌ها"];
    ids.forEach((id, i) => {
      const num = host.querySelector(`#${id}`)!;
      expect(num?.className).toBe("stat-num");
      expect(num?.textContent).toBe(dash.faNum(values[i])); /* Persian digits — the same formatter the controller used */
      const card = num.closest(".stat-card")!;
      expect(card.querySelector(".stat-lbl")?.textContent).toBe(labels[i]);
    });
    /* the static section wrapper is NOT React-owned (aria-label stays) */
    expect(host.getAttribute("aria-label")).toBe("آمار کلی");
    root.unmount();
    await tick();
    expect(host.querySelectorAll(".stat-card").length).toBe(0);
  });

  test("re-render updates the numbers in place (store subscription path)", async () => {
    const { host, root } = mount(<StatsStrip stats={{ total: 0, notes: 0, pages: 0, sites: 0 }} />);
    await tick();
    expect(host.querySelector("#st-total")?.textContent).toBe(dash.faNum(0));
    root.render(<StatsStrip stats={{ total: 42, notes: 0, pages: 7, sites: 2 }} />);
    await tick();
    expect(host.querySelector("#st-total")?.textContent).toBe(dash.faNum(42));
    root.unmount();
  });
});

describe("DisabledHosts (Phase 8 slice 2)", () => {
  /* the region host is the whole .set-sec (heading + description + chips +
     add row move under React); #toasts must exist — the component toasts
     into the same container the controller's flows do */
  function hostSection(): HTMLElement {
    const sec = document.createElement("section");
    sec.className = "set-sec";
    document.body.appendChild(sec);
    const toasts = document.createElement("div");
    toasts.id = "toasts";
    document.body.appendChild(toasts);
    return sec;
  }

  function toasts(): HTMLElement[] {
    return [...document.querySelectorAll("#toasts .toast")] as HTMLElement[];
  }

  test("static shell contract: heading, description, chips container, add row", async () => {
    const sec = hostSection();
    const { root } = mount(<DisabledHosts hosts={["a.com"]} onRemove={() => {}} onAdd={async () => {}} />, sec);
    await tick();
    expect(sec.querySelector("h3")?.textContent).toBe("سایت‌های غیرفعال");
    expect(sec.querySelector("p.muted.small")?.textContent).toContain("هایلایت ساخته یا نمایش داده نمی‌شود");
    expect(sec.querySelector("#host-chips")).not.toBeNull();
    const input = sec.querySelector("#host-input")!;
    expect(input.getAttribute("placeholder")).toBe("افزودن دامنه (مثل example.com)");
    expect(input.getAttribute("aria-label")).toBe("دامنه‌ی جدید");
    expect(sec.querySelector("#host-add")?.textContent).toBe("افزودن");
    root.unmount();
  });

  test("empty state: p.muted.small with the exact copy the builder wrote", async () => {
    const sec = hostSection();
    const { root } = mount(<DisabledHosts hosts={[]} onRemove={() => {}} onAdd={async () => {}} />, sec);
    await tick();
    expect(sec.querySelector("#host-chips p.muted.small")?.textContent).toBe("هنوز سایتی غیرفعال نشده است.");
    root.unmount();
  });

  test("chips: .hchip per host + .hchip-x remove button (text, title, aria, svg)", async () => {
    const sec = hostSection();
    const { root } = mount(<DisabledHosts hosts={["old.example.com", "news.example.org"]} onRemove={() => {}} onAdd={async () => {}} />, sec);
    await tick();
    const chips = sec.querySelectorAll("#host-chips .hchip");
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toContain("old.example.com");
    const x = chips[0].querySelector("button.hchip-x")!;
    expect(x.getAttribute("title")).toBe("حذف old.example.com");
    expect(x.getAttribute("aria-label")).toBe("حذف old.example.com");
    expect(x.querySelector("svg")).not.toBeNull();
    root.unmount();
  });

  test("remove: clicking .hchip-x calls onRemove with that host", async () => {
    const sec = hostSection();
    const removed: string[] = [];
    const { root } = mount(<DisabledHosts hosts={["a.com", "b.com"]} onRemove={(h) => { removed.push(h); }} onAdd={async () => {}} />, sec);
    await tick();
    (sec.querySelectorAll("button.hchip-x")[1] as HTMLElement).click();
    expect(removed).toEqual(["b.com"]);
    root.unmount();
  });

  test("add: Enter commits a sanitized host (trim/lowercase), clears input, success toast", async () => {
    const sec = hostSection();
    const added: string[] = [];
    const { root } = mount(<DisabledHosts hosts={[]} onRemove={() => {}} onAdd={async (h) => { added.push(h); }} />, sec);
    await tick();
    /* uncontrolled input — the component reads the DOM value at commit,
       exactly like the controller read els.hostInput.value */
    const input = sec.querySelector("#host-input") as HTMLInputElement;
    input.value = "  Example.COM/foo ";
    input.focus(); /* the real gesture: the user is typing in this field */
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await tick();
    expect(added).toEqual(["example.com"]);
    await tick();
    expect((sec.querySelector("#host-input") as HTMLInputElement).value).toBe("");
    expect(toasts().length).toBe(1);
    expect(toasts()[0].textContent).toBe("سایت example.com غیرفعال شد");
    root.unmount();
  });

  test("add: invalid input → error toast, onAdd never called", async () => {
    const sec = hostSection();
    let called = 0;
    const { root } = mount(<DisabledHosts hosts={[]} onRemove={() => {}} onAdd={async () => { called++; }} />, sec);
    await tick();
    const input = sec.querySelector("#host-input") as HTMLInputElement;
    input.value = "!!!";
    (sec.querySelector("#host-add") as HTMLElement).click();
    await tick();
    expect(called).toBe(0);
    expect(toasts().length).toBe(1);
    expect(toasts()[0].className).toContain("error");
    expect(toasts()[0].textContent).toBe("دامنه‌ی معتبر وارد کنید (مثل example.com)");
    root.unmount();
  });

  test("add: duplicate host → info toast, onAdd not called", async () => {
    const sec = hostSection();
    let called = 0;
    const { root } = mount(<DisabledHosts hosts={["a.com"]} onRemove={() => {}} onAdd={async () => { called++; }} />, sec);
    await tick();
    const input = sec.querySelector("#host-input") as HTMLInputElement;
    input.value = "a.com";
    (sec.querySelector("#host-add") as HTMLElement).click();
    await tick();
    expect(called).toBe(0);
    expect(toasts()[0].className).toContain("info");
    expect(toasts()[0].textContent).toBe("این دامنه قبلاً اضافه شده است");
    root.unmount();
  });

  test("add failure: onAdd rejects → error toast (rollback is the data layer's job)", async () => {
    const sec = hostSection();
    const { root } = mount(<DisabledHosts hosts={[]} onRemove={() => {}} onAdd={async () => { throw new Error("storage"); }} />, sec);
    await tick();
    const input = sec.querySelector("#host-input") as HTMLInputElement;
    input.value = "a.com";
    (sec.querySelector("#host-add") as HTMLElement).click();
    await tick();
    expect(toasts()[0].className).toContain("error");
    expect(toasts()[0].textContent).toBe("ذخیره تنظیمات ناموفق بود");
    root.unmount();
  });
});

describe("BulkToggle (Phase 8 slice 3)", () => {
  /* the region host is .list-bar — React owns its children (the button) */
  function listBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "list-bar";
    document.body.appendChild(bar);
    return bar;
  }

  test("static shell contract: #btn-bulk keeps id + classes", async () => {
    const bar = listBar();
    const { root } = mount(<BulkToggle action="expand" onApply={() => {}} />, bar);
    await tick();
    const btn = bar.querySelector("button#btn-bulk") as HTMLElement;
    expect(btn.className).toBe("btn btn-ghost bulk-toggle");
    expect(btn.hidden).toBe(false);
    root.unmount();
  });

  test("no action ('') → button hidden, shell empty", async () => {
    const bar = listBar();
    const { root } = mount(<BulkToggle action="" onApply={() => {}} />, bar);
    await tick();
    const btn = bar.querySelector("button#btn-bulk") as HTMLElement;
    expect(btn.hidden).toBe(true);
    expect(btn.textContent).toBe("");
    root.unmount();
  });

  test("expand: label + title + chevrons-down icon (meta from the single source)", async () => {
    const bar = listBar();
    const { root } = mount(<BulkToggle action="expand" onApply={() => {}} />, bar);
    await tick();
    const btn = bar.querySelector("button#btn-bulk") as HTMLElement;
    const meta = BULK_ACTION_META.expand;
    expect(btn.getAttribute("title")).toBe(meta.title);
    expect(btn.querySelector(".bt-lbl")?.textContent).toBe(meta.label);
    expect(btn.querySelector(".bt-ic")?.getAttribute("aria-hidden")).toBe("true");
    expect(btn.querySelectorAll(".bt-ic polyline").length).toBe(2); /* two chevrons */
    root.unmount();
  });

  test("collapse: label + title + chevrons-up icon", async () => {
    const bar = listBar();
    const { root } = mount(<BulkToggle action="collapse" onApply={() => {}} />, bar);
    await tick();
    const btn = bar.querySelector("button#btn-bulk") as HTMLElement;
    const meta = BULK_ACTION_META.collapse;
    expect(btn.getAttribute("title")).toBe(meta.title);
    expect(btn.querySelector(".bt-lbl")?.textContent).toBe(meta.label);
    expect(btn.querySelectorAll(".bt-ic polyline").length).toBe(2);
    root.unmount();
  });

  test("click applies the action exactly once", async () => {
    const bar = listBar();
    let applied = 0;
    const { root } = mount(<BulkToggle action="expand" onApply={() => { applied++; }} />, bar);
    await tick();
    (bar.querySelector("button#btn-bulk") as HTMLElement).click();
    await tick();
    expect(applied).toBe(1);
    root.unmount();
  });
});

describe("ThemeRadios + ColorDots + BehaviorSwitches (Phase 8 slice 7)", () => {
  function setSec(id: string): HTMLElement {
    const sec = document.createElement("section");
    sec.className = "set-sec";
    sec.dataset.probe = id;
    document.body.appendChild(sec);
    return sec;
  }

  test("ThemeRadios: one radio per THEME_KEYS — labels from the registry, hints from the single source", async () => {
    const sec = setSec("theme");
    const { root } = mount(<ThemeRadios theme="auto" onSelect={() => {}} />, sec);
    await tick();
    const radios = sec.querySelectorAll('input[type="radio"][name="hlx-theme"]');
    expect(radios.length).toBe(3);
    const labels = [...sec.querySelectorAll("label.radio")];
    labels.forEach((lab, i) => {
      const key = THEME_KEYS[i];
      expect(lab.querySelector("input")?.getAttribute("value")).toBe(key);
      expect(lab.querySelector("strong")?.textContent).toBe((THEMES as Record<string, { label: string }>)[key].label);
      expect(lab.querySelector(".muted.small")?.textContent).toBe(THEME_HINTS[key]);
      expect((lab.querySelector("input") as HTMLInputElement).checked).toBe(key === "auto");
    });
    root.unmount();
  });

  test("ThemeRadios: selecting a radio calls onSelect with its key", async () => {
    const sec = setSec("theme2");
    const picked: string[] = [];
    const { root } = mount(<ThemeRadios theme="auto" onSelect={(k) => picked.push(k)} />, sec);
    await tick();
    const dark = sec.querySelector('input[value="dark"]') as HTMLInputElement;
    dark.click();
    await tick();
    expect(picked).toEqual(["dark"]);
    root.unmount();
  });

  test("ColorDots: one dot per COLOR_KEYS — registry colors, active + aria-checked on selected", async () => {
    const sec = setSec("dots");
    const { root } = mount(<ColorDots defaultColor="teal" onSelect={() => {}} />, sec);
    await tick();
    const dots = sec.querySelectorAll("button.cdot");
    expect(dots.length).toBe(5);
    const teal = sec.querySelector('button.cdot[data-key="teal"]')!;
    expect(teal.classList.contains("active")).toBe(true);
    expect(teal.getAttribute("aria-checked")).toBe("true");
    expect(teal.getAttribute("title")).toBe("رنگ پیش‌فرض: " + (COLORS as any).teal.label);
    expect(teal.querySelector(".dot")?.getAttribute("style")).toContain((COLORS as any).teal.dot);
    const inactive = sec.querySelector('button.cdot[data-key="yellow"]')!;
    expect(inactive.classList.contains("active")).toBe(false);
    expect(inactive.getAttribute("aria-checked")).toBeNull();
    root.unmount();
  });

  test("ColorDots: clicking a dot calls onSelect with its key", async () => {
    const sec = setSec("dots2");
    const picked: string[] = [];
    const { root } = mount(<ColorDots defaultColor="yellow" onSelect={(k) => picked.push(k)} />, sec);
    await tick();
    (sec.querySelector('button.cdot[data-key="pink"]') as HTMLElement).click();
    await tick();
    expect(picked).toEqual(["pink"]);
    root.unmount();
  });

  test("BehaviorSwitches: two switches — ids, labels, checked mirror settings", async () => {
    const sec = setSec("switches");
    const { root } = mount(<BehaviorSwitches showToolbar={true} showBadge={false} onToggle={() => {}} />, sec);
    await tick();
    const tb = sec.querySelector("#set-toolbar") as HTMLInputElement;
    const bd = sec.querySelector("#set-badge") as HTMLInputElement;
    expect(tb.checked).toBe(true);
    expect(bd.checked).toBe(false);
    expect(tb.closest("label")!.querySelector(".switch-lbl")?.textContent).toBe("نمایش نوار ابزار هنگام انتخاب متن");
    expect(bd.closest("label")!.querySelector(".switch-lbl")?.textContent).toBe("نمایش شمارنده روی آیکون");
    root.unmount();
  });

  test("BehaviorSwitches: toggling calls onToggle with the new boolean", async () => {
    const sec = setSec("switches2");
    const calls: Array<[string, boolean]> = [];
    const { root } = mount(
      <BehaviorSwitches
        showToolbar={false}
        showBadge={false}
        onToggle={(key, v) => calls.push([key, v])}
      />,
      sec
    );
    await tick();
    (sec.querySelector("#set-toolbar") as HTMLInputElement).click();
    await tick();
    (sec.querySelector("#set-badge") as HTMLInputElement).click();
    await tick();
    expect(calls).toEqual([["showToolbar", true], ["showBadge", true]]);
    root.unmount();
  });
});

describe("EmptyState + LoadMore (Phase 8 slice 6)", () => {
  test("EmptyState: hidden when shown=false, byte-equal skeleton otherwise", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { root } = mount(<EmptyState shown={false} hasRecords={false} />, host);
    await tick();
    const empty = host.querySelector("#empty") as HTMLElement;
    expect(empty.hidden).toBe(true);
    expect(empty.className).toBe("empty");
    root.unmount();
  });

  test("EmptyState: empty-store copy (hasRecords=false)", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { root } = mount(<EmptyState shown={true} hasRecords={false} />, host);
    await tick();
    const empty = host.querySelector("#empty") as HTMLElement;
    expect(empty.hidden).toBe(false);
    expect(empty.querySelector("#empty-title")?.textContent).toBe("هنوز هایلایتی ثبت نشده. اولین متن را انتخاب کنید!");
    expect(empty.querySelector("#empty-sub")?.textContent).toBe("روی هر صفحه‌ی وب، متن را انتخاب کن و از نوار شناور افزونه استفاده کن.");
    expect(empty.querySelector(".empty-ic svg")).not.toBeNull();
    root.unmount();
  });

  test("EmptyState: filtered-out copy (hasRecords=true)", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { root } = mount(<EmptyState shown={true} hasRecords={true} />, host);
    await tick();
    expect(host.querySelector("#empty-title")?.textContent).toBe("نتیجه‌ای پیدا نشد.");
    expect(host.querySelector("#empty-sub")?.textContent).toBe("عبارت جست‌وجو یا فیلترهای رنگ و برچسب را تغییر بده.");
    root.unmount();
  });

  test("LoadMore: hidden without overflow, Persian count label otherwise", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { root } = mount(<LoadMore shown={false} overflow={0} onLoadMore={() => {}} />, host);
    await tick();
    const btn = host.querySelector("button#load-more") as HTMLElement;
    expect(btn.hidden).toBe(true);
    expect(btn.className).toBe("btn btn-ghost load-more");
    root.unmount();

    const host2 = document.createElement("div");
    document.body.appendChild(host2);
    const applied: number[] = [];
    const root2 = createRoot(host2);
    root2.render(<LoadMore shown={true} overflow={23} onLoadMore={() => applied.push(1)} />);
    await tick();
    const btn2 = host2.querySelector("button#load-more") as HTMLElement;
    expect(btn2.hidden).toBe(false);
    expect(btn2.textContent).toBe("بارگذاری بیشتر (" + dash.faNum(23) + " مورد باقی‌مانده)");
    btn2.click();
    await tick();
    expect(applied).toEqual([1]);
    root2.unmount();
  });
});

describe("Modals (Phase 8 slice 5)", () => {
  const REC = {
    id: "w1", host: "fa.wikipedia.org", url: "https://fa.wikipedia.org/wiki/Persian",
    urlNorm: "https://fa.wikipedia.org/wiki/Persian", title: "دانشنامه‌ی فارسی",
    text: "مغز ما هنگام خواندن وارد گفت‌وگو می‌شود",
    note: "ایده‌ی کلیدی: خواندن یعنی گفت‌وگو", color: "yellow", createdAt: 1700000000000, updatedAt: 1700000001000,
  } as any;

  test("PreviewModal: the v0.6.4 fully-smart skeleton — no X, card is the focus anchor", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { root } = mount(<PreviewModal rec={REC} onClose={() => {}} />, host);
    await tick();
    const modal = host.querySelector("#hl-modal") as HTMLElement;
    expect(modal.hidden).toBe(false);
    const card = host.querySelector("#hl-card")!;
    expect(card.getAttribute("tabindex")).toBe("-1"); /* the programmatic focus anchor */
    expect(card.getAttribute("role")).toBe("dialog");
    expect(card.getAttribute("aria-modal")).toBe("true");
    expect(card.getAttribute("aria-labelledby")).toBe("hl-title");
    expect(card.getAttribute("dir")).toBe("rtl"); /* frame follows the text's direction */
    expect(host.querySelectorAll("#hl-card button").length).toBe(0); /* the X is GONE */
    expect(host.querySelector("#hl-title")?.getAttribute("dir")).toBe("rtl");
    expect(host.querySelector("#hl-title")?.textContent).toContain("دانشنامه‌ی فارسی");
    expect(host.querySelector(".hl-quote-t")?.textContent).toBe(REC.text); /* FULL text, never excerpted */
    expect(host.querySelector(".hl-quote")?.getAttribute("dir")).toBe("rtl");
    expect(host.querySelector(".note")?.getAttribute("dir")).toBe("rtl"); /* note ROW direction */
    expect(host.querySelector(".hl-meta-t")?.getAttribute("dir")).toBe("rtl"); /* date RTL island */
    root.unmount();
  });

  test("PreviewModal: closed → hidden shell, no leftovers", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { root } = mount(<PreviewModal rec={null} onClose={() => {}} />, host);
    await tick();
    expect((host.querySelector("#hl-modal") as HTMLElement).hidden).toBe(true);
    expect(host.querySelector("#hl-card")).not.toBeNull(); /* skeleton stays, content empty */
    expect(host.querySelector(".hl-quote-t")).toBeNull();
    root.unmount();
  });

  test("PreviewModal: overlay click OUTSIDE the card closes; card clicks don't", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let closed = 0;
    const { root } = mount(<PreviewModal rec={REC} onClose={() => { closed++; }} />, host);
    await tick();
    (host.querySelector("#hl-modal") as HTMLElement).click();
    await tick();
    expect(closed).toBe(1);
    (host.querySelector("#hl-card") as HTMLElement).click();
    await tick();
    expect(closed).toBe(1); /* clicks inside the card never count as the overlay */
    root.unmount();
  });

  test("RestoreModal: byte-equal skeleton — title, summary rows, imp-mode radios, actions", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const backup = { name: "من", highlights: { a: {}, b: {}, c: {} }, exportedAt: 1700000000000, version: "0.6.7", meta: { count: 3 } };
    const { root, host: h } = mount(<RestoreModal req={{ open: true, payload: { kind: "restore", backup } }} onClose={() => {}} onImport={async () => {}} />, host);
    await tick();
    expect((h.querySelector("#modal") as HTMLElement).hidden).toBe(false);
    const rows = [...h.querySelectorAll("#modal-summary .sum-row")].map((r) => r.textContent);
    expect(rows.length).toBe(4);
    expect(rows[0]).toContain("نام مجموعه");
    expect(rows[1]).toContain(dash.faNum(3));
    expect(h.querySelectorAll('input[name="imp-mode"]').length).toBe(2);
    expect((h.querySelector('input[name="imp-mode"][value="merge"]') as HTMLInputElement).checked).toBe(true);
    expect(h.querySelector("#imp-cancel")?.textContent).toBe("انصراف");
    expect((h.querySelector("#imp-go") as HTMLButtonElement).disabled).toBe(false);
    root.unmount();
  });

  test("RestoreModal: import runs with the selected mode; success closes", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const calls: string[] = [];
    const { root, host: h } = mount(
      <RestoreModal
        req={{ open: true, payload: { kind: "restore", backup: { highlights: {} } } }}
        onClose={() => calls.push("close")}
        onImport={async (b, mode) => { calls.push(mode); }}
      />,
      host
    );
    await tick();
    (h.querySelector('input[name="imp-mode"][value="replace"]') as HTMLInputElement).click();
    await tick();
    (h.querySelector("#imp-go") as HTMLElement).click();
    await tick();
    expect(calls).toEqual(["replace", "close"]);
    root.unmount();
  });

  test("BookletModal: summary from the SAME computeStats + radio groups read at click time", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const calls: Array<[string, string, BookletBuildOptions]> = [];
    const { root, host: h } = mount(
      <BookletModal
        req={{ open: true, payload: { kind: "booklet" } }}
        onClose={() => {}}
        stats={{ total: 7, notes: 2, pages: 5, sites: 3 }}
        articleOptions={[{ key: "https://a.com/p1", host: "a.com", title: "مقاله الف", count: 3 }]}
        fontOptions={FONTS}
        onMarkdown={async () => { calls.push(["md", "", { articles: [], font: "vazir" }]); }}
        onBooklet={async (f, m, o) => { calls.push([f, m, o]); }}
      />,
      host
    );
    await tick();
    const rows = [...h.querySelectorAll("#booklet-summary .sum-row")].map((r) => r.textContent);
    expect(rows.length).toBe(3);
    expect(rows[0]).toContain(dash.faNum(7));
    expect(h.querySelectorAll('input[name="bk-format"]').length).toBe(2);
    expect(h.querySelectorAll('input[name="bk-color"]').length).toBe(2);
    expect(h.querySelectorAll('input[name="bk-font"]').length).toBe(FONTS.length + 1); /* presets + the custom local-font row */
    (h.querySelector('input[name="bk-format"][value="pdf"]') as HTMLInputElement).click();
    await tick();
    (h.querySelector("#bk-go") as HTMLElement).click();
    await tick();
    (h.querySelector("#md-go") as HTMLElement).click();
    await tick();
    expect(calls).toEqual([
      ["pdf", "color", { articles: [], font: "vazir" }],
      ["md", "", { articles: [], font: "vazir" }],
    ]);
    root.unmount();
  });

  test("Escape closes an open modal", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let closed = 0;
    const { root } = mount(<PreviewModal rec={REC} onClose={() => { closed++; }} />, host);
    await tick();
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await tick();
    expect(closed).toBe(1);
    root.unmount();
  });
});

describe("BackupModal (بک‌آپ انتخابی)", () => {
  const OPTIONS = {
    sites: [{ host: "a.com", articles: 2 }, { host: "b.org", articles: 1 }],
    articles: [
      { key: "https://a.com/p1", host: "a.com", title: "مقاله الف", count: 3 },
      { key: "https://b.org/x", host: "b.org", title: "مقاله پ", count: 1 },
    ],
    tags: [{ tag: "قرآن", count: 2 }, { tag: "علم", count: 1 }],
  };

  test("سه بخش انتخاب با گزینه‌ها و شمارش‌ها رندر می‌شود؛ بدون انتخاب دکمه غیرفعال است", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { root, host: h } = mount(
      <BackupModal req={{ open: true, payload: { kind: "backup" } }} onClose={() => {}} options={OPTIONS} countOf={() => 0} onExport={async () => {}} />,
      host
    );
    await tick();
    expect((h.querySelector("#backup-modal") as HTMLElement).hidden).toBe(false);
    expect(h.querySelector("#backup-title")?.textContent).toBe("بک‌آپ انتخابی");
    const groups = [...h.querySelectorAll(".sel-list")];
    expect(groups.length).toBe(3);
    expect([...groups[0].querySelectorAll(".sel-item")].map((r) => r.textContent)).toEqual([
      "a.com" + dash.faNum(2) + " مقاله",
      "b.org" + dash.faNum(1) + " مقاله",
    ]);
    expect((groups[1].querySelector(".sel-item .sel-label") as HTMLElement).textContent).toBe("مقاله الف");
    expect((h.querySelector("#backup-go") as HTMLButtonElement).disabled).toBe(true);
    expect(h.querySelector("#backup-status")?.textContent).toContain("حداقل یک مورد");
    root.unmount();
  });

  test("انتخاب، countOf را با آرایه‌های انتخاب صدا می‌زند؛ شمار زنده و دکمه فعال می‌شود", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let seen: any = null;
    const { root, host: h } = mount(
      <BackupModal
        req={{ open: true, payload: { kind: "backup" } }}
        onClose={() => {}}
        options={OPTIONS}
        countOf={(sel) => { seen = sel; return 5; }}
        onExport={async () => {}}
      />,
      host
    );
    await tick();
    (h.querySelector('.sel-list input[type="checkbox"]') as HTMLInputElement).click();
    await tick();
    expect(seen).toEqual({ hosts: ["a.com"], articles: [], tags: [] });
    expect((h.querySelector("#backup-status")?.textContent || "")).toContain(dash.faNum(5));
    expect((h.querySelector("#backup-go") as HTMLButtonElement).disabled).toBe(false);
    root.unmount();
  });

  test("دریافت فایل: onExport با همان انتخاب صدا زده شده و مودال بسته می‌شود", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const calls: any[] = [];
    const { root, host: h } = mount(
      <BackupModal
        req={{ open: true, payload: { kind: "backup" } }}
        onClose={() => calls.push("close")}
        options={OPTIONS}
        countOf={() => 4}
        onExport={async (sel) => { calls.push(["export", sel]); }}
      />,
      host
    );
    await tick();
    const boxes = [...h.querySelectorAll('.sel-list input[type="checkbox"]')] as HTMLInputElement[];
    boxes[0].click(); await tick();          /* site a.com */
    boxes[2].click(); await tick();          /* article https://a.com/p1 */
    boxes[4].click(); await tick();          /* tag قرآن */
    (h.querySelector("#backup-go") as HTMLElement).click();
    await tick();
    expect(calls).toEqual([["export", { hosts: ["a.com"], articles: ["https://a.com/p1"], tags: ["قرآن"] }], "close"]);
    root.unmount();
  });

  test("انتخابِ صفرِ منطقی (بدون مطابقت) دکمه را غیرفعال نگه می‌دارد", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { root, host: h } = mount(
      <BackupModal req={{ open: true, payload: { kind: "backup" } }} onClose={() => {}} options={OPTIONS} countOf={() => 0} onExport={async () => {}} />,
      host
    );
    await tick();
    (h.querySelector('.sel-list input[type="checkbox"]') as HTMLInputElement).click();
    await tick();
    expect((h.querySelector("#backup-go") as HTMLButtonElement).disabled).toBe(true);
    expect(h.querySelector("#backup-status")?.textContent).toContain("مطابقت ندارد");
    root.unmount();
  });

  test("بازگشایی مودال، انتخاب قبلی را پاک می‌کند", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { root, host: h } = mount(
      <BackupModal req={{ open: true, payload: { kind: "backup" } }} onClose={() => {}} options={OPTIONS} countOf={() => 3} onExport={async () => {}} />,
      host
    );
    await tick();
    (h.querySelector('.sel-list input[type="checkbox"]') as HTMLInputElement).click();
    await tick();
    const el = (open: boolean) => (
      <BackupModal req={{ open, payload: open ? { kind: "backup" } : null }} onClose={() => {}} options={OPTIONS} countOf={() => 3} onExport={async () => {}} />
    );
    root.render(el(false));
    await tick();
    root.render(el(true));
    await tick();
    expect((h.querySelector('.sel-list input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
    expect((h.querySelector("#backup-go") as HTMLButtonElement).disabled).toBe(true);
    root.unmount();
  });

  test("Escape مودال انتخابی را می‌بندد", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let closed = 0;
    const { root } = mount(
      <BackupModal req={{ open: true, payload: { kind: "backup" } }} onClose={() => { closed++; }} options={OPTIONS} countOf={() => 1} onExport={async () => {}} />,
      host
    );
    await tick();
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await tick();
    expect(closed).toBe(1);
    root.unmount();
  });
});

/* ---------- BookletModal — انتخاب مقاله‌ها + فونت (Task 88) ---------- */

const FONTS: Array<{ id: BookletFontId; label: string }> = [
  { id: "vazir", label: "وزیرمتن" },
];

describe("BookletModal — انتخاب مقاله‌ها و فونت (Task 88)", () => {
  const ARTICLES = [
    { key: "https://a.com/p1", host: "a.com", title: "مقاله الف", count: 3 },
    { key: "https://b.org/x", host: "b.org", title: "مقاله پ", count: 1 },
    { key: "https://c.io/y", host: "c.io", title: "مقاله ت", count: 2 },
  ];

  function booklet(capture: { o?: any }) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    return mount(
      <BookletModal
        req={{ open: true, payload: { kind: "booklet" } }}
        onClose={() => {}}
        stats={{ total: 6, notes: 0, pages: 3, sites: 3 }}
        articleOptions={ARTICLES}
        fontOptions={FONTS}
        onMarkdown={async () => {}}
        onBooklet={async (_f, _m, o) => { capture.o = o; }}
      />,
      host
    );
  }

  test("انتخاب مقاله‌ها: رندر از options + وضعیت پیش‌فرض «همه‌ی مقاله‌ها» (default-all)", async () => {
    const capture: { o?: any } = {};
    const { root, host: h } = booklet(capture);
    await tick();
    const rows = [...h.querySelectorAll(".sel-list .sel-item")].map((r) => r.textContent);
    expect(rows.length).toBe(3);
    expect(rows[0]).toContain("مقاله الف");
    expect(rows[0]).toContain(dash.faNum(3));
    expect((h.querySelector("#booklet-status") as HTMLElement).textContent).toContain("همه‌ی مقاله‌ها");
    (h.querySelector("#bk-go") as HTMLElement).click();
    await tick();
    expect(capture.o).toEqual({ articles: [], font: "vazir" }); /* بدون انتخاب = همه */
    root.unmount();
  });

  test("انتخاب دو مقاله: وضعیت زنده از خود ردیف‌ها + onBooklet دقیقاً همان کلیدها", async () => {
    const capture: { o?: any } = {};
    const { root, host: h } = booklet(capture);
    await tick();
    const boxes = [...h.querySelectorAll('.sel-list input[type="checkbox"]')] as HTMLInputElement[];
    boxes[0].click(); await tick();
    boxes[1].click(); await tick();
    const status = (h.querySelector("#booklet-status") as HTMLElement).textContent || "";
    expect(status).toContain(dash.faNum(4)); /* ۳ + ۱ هایلایت */
    expect(status).toContain(dash.faNum(2)); /* از ۲ مقاله */
    (h.querySelector("#bk-go") as HTMLElement).click();
    await tick();
    expect(capture.o).toEqual({ articles: ["https://a.com/p1", "https://b.org/x"], font: "vazir" });
    root.unmount();
  });

  test("فونت: پیش‌فرض وزیرمتن؛ تغییر به تاهوما به onBooklet می‌رسد", async () => {
    const capture: { o?: any } = {};
    const { root, host: h } = booklet(capture);
    await tick();
    const radios = [...h.querySelectorAll('input[name="bk-font"]')] as HTMLInputElement[];
    expect(radios.length).toBe(2); /* vazir preset + the custom local-font row */
    expect((h.querySelector('input[name="bk-font"][value="vazir"]') as HTMLInputElement).checked).toBe(true);
    (h.querySelector("#bk-go") as HTMLElement).click();
    await tick();
    expect(capture.o).toEqual({ articles: [], font: "vazir", customFont: undefined });
    root.unmount();
  });

  test("فونت دلخواه: تا نام نوشته نشود دکمه غیرفعال است؛ با نام، onBooklet دقیقاً همان را می‌برد", async () => {
    const capture: { o?: any } = {};
    const { root, host: h } = booklet(capture);
    await tick();
    (h.querySelector('input[name="bk-font"][value="custom"]') as HTMLInputElement).click();
    await tick();
    const input = h.querySelector("#bk-custom-font") as HTMLInputElement;
    expect(input.disabled).toBe(false); /* enabled once the custom radio is picked */
    expect((h.querySelector("#bk-go") as HTMLButtonElement).disabled).toBe(true); /* no name yet */
    /* controlled input: React's value tracker dedupes a plain .value write —
       go through the native setter so onChange really fires */
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    nativeSetter.call(input, "B Nazanin");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await tick();
    const go = h.querySelector("#bk-go") as HTMLButtonElement;
    expect(go.disabled).toBe(false);
    go.click();
    await tick();
    expect(capture.o).toEqual({ articles: [], font: "custom", customFont: "B Nazanin" });
    root.unmount();
  });

  test("فونت دلخواه: نام خالیِ پس از پاک‌سازی، درخت را به پیش‌فرض برنمی‌گرداند — گیت جلویش را می‌گیرد", async () => {
    const capture: { o?: any } = {};
    const { root, host: h } = booklet(capture);
    await tick();
    (h.querySelector('input[name="bk-font"][value="custom"]') as HTMLInputElement).click();
    await tick();
    const input = h.querySelector("#bk-custom-font") as HTMLInputElement;
    input.value = '   ";{}  '; /* sanitizes to nothing */
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await tick();
    expect((h.querySelector("#bk-go") as HTMLButtonElement).disabled).toBe(true);
    expect(capture.o).toBeUndefined();
    root.unmount();
  });

  test("باز شدن دوباره: انتخاب و فونت به پیش‌فرض برمی‌گردند (one-shot picker)", async () => {
    const capture: { o?: any } = {};
    const { root, host: h } = booklet(capture);
    await tick();
    (h.querySelector('.sel-list input[type="checkbox"]') as HTMLInputElement).click();
    await tick();
    (h.querySelector('input[name="bk-font"][value="custom"]') as HTMLInputElement).click();
    await tick();
    const base = {
      onClose: () => {},
      stats: { total: 6, notes: 0, pages: 3, sites: 3 },
      articleOptions: ARTICLES,
      fontOptions: FONTS,
      onMarkdown: async () => {},
      onBooklet: async () => {},
    };
    root.render(<BookletModal req={{ open: false, payload: null }} {...base} />);
    await tick();
    root.render(<BookletModal req={{ open: true, payload: { kind: "booklet" } }} {...base} />);
    await tick();
    expect((h.querySelector('.sel-list input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
    expect((h.querySelector('input[name="bk-font"][value="vazir"]') as HTMLInputElement).checked).toBe(true);
    expect((h.querySelector("#booklet-status") as HTMLElement).textContent).toContain("همه‌ی مقاله‌ها");
    root.unmount();
  });

  test("Markdown مستقل است: بدون مقاله پیام خالی می‌آید و دکمه‌ی md کار می‌کند", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let md = 0;
    const { root, host: h } = mount(
      <BookletModal
        req={{ open: true, payload: { kind: "booklet" } }}
        onClose={() => {}}
        stats={{ total: 0, notes: 0, pages: 0, sites: 0 }}
        articleOptions={[]}
        fontOptions={FONTS}
        onMarkdown={async () => { md++; }}
        onBooklet={async () => {}}
      />,
      host
    );
    await tick();
    expect(h.querySelector(".sel-list")).toBeNull(); /* بدون مقاله → پیام خالی */
    expect(h.querySelector(".sel-none")?.textContent).toBe("مقاله‌ای ثبت نشده است");
    (h.querySelector("#md-go") as HTMLElement).click();
    await tick();
    expect(md).toBe(1);
    root.unmount();
  });
});
