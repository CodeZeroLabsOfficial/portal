import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          {APP_NAME}
        </Link>
      </div>
    </header>
  );
}
