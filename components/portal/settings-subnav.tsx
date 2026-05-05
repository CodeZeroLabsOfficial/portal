"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_NAV_ITEMS, getSettingsNavLabel } from "@/lib/settings-nav";
import { cn } from "@/lib/utils";

export function SettingsSubnav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-0.5 p-3">
      {SETTINGS_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors",
              active
                ? "bg-white/[0.08] text-white"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 stroke-[1.5]" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SettingsBreadcrumb() {
  const pathname = usePathname();
  const section = getSettingsNavLabel(pathname);

  return (
    <div className="mb-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/settings/profile" className="font-medium text-zinc-400 hover:text-white">
          Settings
        </Link>
        {section ? (
          <>
            <span className="mx-1.5 text-zinc-600" aria-hidden>
              /
            </span>
            <span className="text-white">{section}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

export function SettingsInner({ children }: { children: ReactNode }) {
  return (
    <>
      <SettingsBreadcrumb />
      {children}
    </>
  );
}
