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
import { dashView } from "../../extension/dashboard/dashboard-view.js";
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
    expect(toasts()[0].textContent).toBe("دامنه‌ی معتبر وارد کن (مثل example.com)");
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
    const meta = dashView.BULK_ACTION_META.expand;
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
    const meta = dashView.BULK_ACTION_META.collapse;
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
