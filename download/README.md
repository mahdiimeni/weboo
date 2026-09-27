# download/ — release artifacts

Current deliverables (v0.6.4 — the current project stage):

| File | What it is |
|---|---|
| `web-highlighter-repo-v0.6.4.tar.gz` | **GitHub repository bundle** (extension-only, clean root-level layout) — extract, then `git remote add origin <url> && git push -u origin main`. Twelve commits: `v0.1.0` initial + `v0.2.0` (direction-separated article sections) + `v0.3.0` (bulk expand/collapse all articles) + `v0.4.0` (per-article highlight order toggle) + `v0.5.0` (collapsible direction sections) + `v0.5.1` (note popover: centered «افزودن یادداشت» pill + icon-only edit action) + `v0.5.2` (smart Persian chrome directions in LTR cards + centered stat cards & tag input) + `v0.6.0` (**reading exports: Markdown library document for Obsidian + print booklet — HTML/PDF, color/B&W, A4 print-ready**) + `v0.6.1` (**highlight full-text preview modal (close on X / outside click / Escape) + direction-smart article tags in LTR cards**) + `v0.6.2` (**two-granularity tag direction — the chip is always RTL chrome (X at the reading end), the tag text keeps its own direction; the «جدیدترین» order pill is RTL chrome in LTR cards too**) + `v0.6.3` (**dashboard UX refinement — the preview modal's head shows the article's own title with a date-only meta line; direction sections renamed «راست‌چین‌ها»/«چپ‌چین‌ها»; light-blue count capsules; topbar: «کتابچه» first, icon-only export/settings buttons, restore moved into the settings drawer, one aligned 40px action-row height**) + `v0.6.4` (**fully direction-smart preview window — the modal frame turns to the record's own direction (LTR window for an English highlight), the title aligns at its own reading start in a smaller 15px size, the fa date is an inline RTL island in a frame-flow row; the X button removed — an outside click (and Escape) closes, the card itself is the focus anchor**); the repo root itself is the extension (Load unpacked → repo root). |
| `highlighter-extension-v0.6.4.zip` | Installable extension package — extract → Chrome → `chrome://extensions` → Load unpacked. Content-identical to what the repo's `bun run zip` produces. |

The workspace's Next.js preview page (the `/` route) is the distribution
landing (download + features); the repository bundle is the extension and its
tooling only.

Note: these files are force-tracked in git (past `.gitignore`) so they survive
workspace resets and are included when you download the workspace.
