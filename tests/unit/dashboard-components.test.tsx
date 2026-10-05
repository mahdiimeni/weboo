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
import { dash } from "../../extension/dashboard/dashboard-data.js";

beforeEach(() => { setupDom(); });

const tick = () => new Promise((r) => setTimeout(r, 20));

function mount(jsx: any): { host: HTMLElement; root: ReturnType<typeof createRoot> } {
  const host = document.createElement("div");
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
