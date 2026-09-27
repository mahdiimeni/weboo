import { readReleaseArtifact } from "@/lib/extension-release";

export const dynamic = "force-dynamic";

/**
 * GET /api/extension/download
 *
 * سرو کردن zip انتشار فعلی (نسخه از extension/manifest.json) به‌صورت
 * attachment. اگر artifact موجود نباشد، همان لحظه با اسکریپت قرارداد
 * انتشار ساخته می‌شود. همیشه مسیر نسبی — از مرورگر:
 *   <a href="/api/extension/download" download>
 */
export async function GET() {
  try {
    const { filename, bytes } = await readReleaseArtifact();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/extension/download] release artifact unavailable:", error);
    return Response.json({ error: "extension_release_unavailable" }, { status: 500 });
  }
}
