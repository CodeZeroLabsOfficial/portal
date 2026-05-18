import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/app-providers";
import { APP_NAME } from "@/lib/constants";
import { APP_SHELL_FONT_CLASS, PROPOSAL_GOOGLE_FONTS_STYLESHEET_HREF } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Subscription, billing, and interactive proposal management for Code Zero Labs — built for teams and customers.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={PROPOSAL_GOOGLE_FONTS_STYLESHEET_HREF} rel="stylesheet" />
      </head>
      <body className={`${APP_SHELL_FONT_CLASS} min-h-dvh font-sans`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
