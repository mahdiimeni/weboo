import { Download, Highlighter, BookOpen, FileText, ShieldCheck, FileDown } from "lucide-react";
import { releaseInfo } from "@/lib/extension-release";

/* نسخه از منبع واحد: manifest افزونه — از طریق لایه‌ی artifact انتشار */

const INSTALL_STEPS = [
  "فایل zip را دانلود کنید و از حالت فشرده خارج کنید (Extract)",
  "در گوگل کروم به نشانی chrome://extensions بروید",
  "«Developer mode» را روشن کنید و با «Load unpacked» پوشه‌ی خارج‌شده را انتخاب کنید",
];

const FEATURES = [
  {
    icon: Highlighter,
    title: "هایلایت ۵ رنگ + یادداشت",
    desc: "رنگ دلخواه روی هر متن و یادداشت روی هر هایلایت — نوار ابزار شناور و کلید Alt+Shift+H",
  },
  {
    icon: FileText,
    title: "خروجی Markdown",
    desc: "کل کتابخانه در یک فایل Markdown با ساختار آماده برای Obsidian — هر مقاله یک بخش",
  },
  {
    icon: BookOpen,
    title: "کتابچه چاپی",
    desc: "جلد، فهرست و هر مقاله در صفحه‌ای جدا — PDF یا HTML، رنگی یا سیاه‌وسفید، آماده‌ی چاپ A4",
  },
  {
    icon: ShieldCheck,
    title: "۱۰۰٪ محلی",
    desc: "همه‌ی داده‌ها فقط روی دستگاه شما — بدون سرور، بدون حساب کاربری، بدون اشتراک",
  },
];

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}

export default async function Home() {
  const info = await releaseInfo();
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">وب هایلایتر</h1>
          <p className="max-w-md text-balance text-muted-foreground">
            هایلایت و یادداشت مقالات وب — ۱۰۰٪ محلی، بدون سرور و بدون حساب کاربری
          </p>
        </div>
        <span
          dir="ltr"
          className="inline-flex items-center rounded-full border bg-secondary px-4 py-1.5 font-mono text-sm text-secondary-foreground"
        >
          v{info.version}
        </span>

        {/* قابلیت‌ها */}
        <section aria-labelledby="features-heading" className="w-full max-w-3xl">
          <h2 id="features-heading" className="mb-1 text-lg font-bold">
            قابلیت‌ها
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            هایلایت و یادداشت مقالات وب — با خروجی‌های مطالعه‌ای برای Obsidian و چاپ
          </p>
          <ul className="grid grid-cols-1 gap-3 text-start sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                >
                  <f.icon className="size-5" />
                </span>
                <span className="space-y-1">
                  <span className="block text-sm font-bold">{f.title}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{f.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* دانلود آخرین نسخه */}
        <section
          aria-labelledby="download-heading"
          className="w-full max-w-xl rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8"
        >
          <h2 id="download-heading" className="flex items-center justify-center gap-2 text-lg font-bold">
            <FileDown className="size-5" aria-hidden="true" />
            دانلود آخرین نسخه‌ی افزونه
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            بسته‌ی zip آماده‌ی نصب در گوگل کروم (نسخه‌ی منتشرشده، بدون فایل آزمون)
          </p>
          <a
            href="/api/extension/download"
            download
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 text-base font-bold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]"
          >
            <Download className="size-5" aria-hidden="true" />
            دانلود افزونه (zip)
          </a>
          <p dir="ltr" className="mt-3 break-all font-mono text-xs text-muted-foreground">
            {info.filename} · {formatSize(info.sizeBytes)}
          </p>

          <div className="mt-6 border-t pt-5 text-start">
            <p className="text-sm font-bold">نصب در گوگل کروم</p>
            <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              {INSTALL_STEPS.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span aria-hidden="true" className="font-bold text-primary">
                    {["۱", "۲", "۳"][index]}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <footer className="mt-auto border-t py-4 text-center text-xs text-muted-foreground">
        ذخیره‌سازی روی دستگاه شما — بدون سرور، بدون حساب کاربری
      </footer>
    </div>
  );
}
