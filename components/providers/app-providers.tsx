"use client";

import * as React from "react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <Toaster richColors closeButton position="top-center" />
    </ThemeProvider>
  );
}
