/**
 * The dashboard's toast — extracted from dashboard-view.js at Phase 8 slice 2
 * so the React regions can raise the exact same toasts the controller's flows
 * did (baseline §3 listed the duplicated helper; the UI phase folds it — the
 * view/controller copies retire with their slices, Task 5 finishes the job).
 *
 * Same behavior contract as view.toast: .toast.<type> appended to #toasts
 * (role=status), .show class via rAF, removed after 3.2s + 300ms fade.
 */
export function toast(msg: string, type?: string): void {
  const container = document.getElementById("toasts");
  if (!container) return;
  const t = document.createElement("div");
  t.className = "toast " + (type || "success");
  t.textContent = msg;
  t.setAttribute("role", "status");
  container.appendChild(t);
  requestAnimationFrame(function () { t.classList.add("show"); });
  setTimeout(function () {
    t.classList.remove("show");
    setTimeout(function () { t.remove(); }, 300);
  }, 3200);
}
