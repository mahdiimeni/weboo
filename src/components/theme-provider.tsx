"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// پوشش کلاینت next-themes — تم پیش‌فرض: سیستم
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
