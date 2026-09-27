import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: "وب هایلایتر — هایلایت و یادداشت، بدون اشتراک",
  description:
    "افزونه‌ی کروم سبک و رایگان برای هایلایت مقالات وب، یادداشت روی هر هایلایت و ذخیره‌سازی ۱۰۰٪ محلی — بدون سرور، بدون اشتراک، بدون محدودیت.",
  keywords: ["هایلایت", "افزونه کروم", "یادداشت", "web highlighter", "وب هایلایتر"],
  authors: [{ name: "وب هایلایتر" }],
  openGraph: {
    title: "وب هایلایتر — هایلایت و یادداشت، بدون اشتراک",
    description: "هایلایت کن، یادداشت بنداز، مالک داده‌هات باش.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* فونت وزیرمتن از Google Fonts (بدون next/font) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
