import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

/**
 * دسترسی سمت سرور به artifact انتشار افزونه.
 *
 * منبع واحد نسخه: extension/manifest.json (هرگز نسخه را hardcode نکنید).
 * artifact انتشار: dist/highlighter-extension-v{version}.zip که با
 * scripts/build-zip.mjs (همان `bun run zip`) ساخته می‌شود — همان قرارداد
 * انتشار همه‌ی نسخه‌ها. اگر artifact موجود نباشد، همان اسکریپت به‌صورت
 * درخواستی اجرا می‌شود تا لینک دانلود هرگز کهنه یا ۴۰۴ نشود.
 */

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "extension", "manifest.json");
const DIST_DIR = path.join(ROOT, "dist");
const BUILD_SCRIPT = path.join(ROOT, "scripts", "build-zip.mjs");

export interface ReleaseInfo {
  /** مثلاً "0.3.0" — از manifest خوانده می‌شود */
  version: string;
  /** مثلاً "highlighter-extension-v0.3.0.zip" */
  filename: string;
  /** مسیر مطلق zip انتشار (ممکن است هنوز ساخته نشده باشد) */
  zipPath: string;
  /** حجم zip به بایت، یا null وقتی artifact هنوز ساخته نشده */
  sizeBytes: number | null;
}

export interface ReleaseArtifact {
  version: string;
  filename: string;
  bytes: Uint8Array;
}

interface ManifestShape {
  version?: unknown;
}

async function readVersion(): Promise<string> {
  const manifest: ManifestShape = JSON.parse(await readFile(MANIFEST_PATH, "utf-8"));
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("extension/manifest.json has no usable version field");
  }
  return manifest.version;
}

/** اطلاعات artifact فعلی بدون ساخت آن (برای نمایش در صفحه). */
export async function releaseInfo(): Promise<ReleaseInfo> {
  const version = await readVersion();
  const filename = `highlighter-extension-v${version}.zip`;
  const zipPath = path.join(DIST_DIR, filename);
  const sizeBytes = existsSync(zipPath) ? (await stat(zipPath)).size : null;
  return { version, filename, zipPath, sizeBytes };
}

/**
 * خواندن بایت‌های zip انتشار؛ در نبود artifact، ساخت درخواستی از طریق
 * همان اسکریپت قرارداد انتشار (بدون تکرار منطق بسته‌بندی اینجا).
 */
export async function readReleaseArtifact(): Promise<ReleaseArtifact> {
  const info = await releaseInfo();
  if (!existsSync(info.zipPath)) {
    await execFileAsync("node", [BUILD_SCRIPT], { cwd: ROOT });
  }
  const buffer = await readFile(info.zipPath);
  return { version: info.version, filename: info.filename, bytes: new Uint8Array(buffer) };
}
