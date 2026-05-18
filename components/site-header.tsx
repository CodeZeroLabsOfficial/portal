import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-center px-4 sm:px-6">
        <Link
          href="/"
          className="outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Code Zero Labs home"
        >
          <Image
            src="/brand/logo-expanded.png"
            alt="Code Zero Labs"
            width={200}
            height={48}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>
      </div>
    </header>
  );
}
