"use client";

import type { ReactNode } from "react";
import * as React from "react";
import Link from "next/link";
import {
  Bell,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceNav } from "@/components/portal/workspace-nav";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "portal-sidebar-collapsed";

interface WorkspaceShellLayoutProps {
  title: string;
  description: string;
  roleLabel: string;
  userLabel: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function WorkspaceShellLayout({
  title,
  description,
  roleLabel,
  userLabel,
  actions,
  children,
}: WorkspaceShellLayoutProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const initial = React.useMemo(() => {
    const ch = userLabel.trim().charAt(0);
    return ch ? ch.toUpperCase() : "?";
  }, [userLabel]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="portal-ui flex min-h-dvh w-full text-[15px] antialiased">
        <aside
          aria-label="Workspace"
          className={cn(
            "sticky top-0 flex h-dvh shrink-0 flex-col border-r border-white/[0.06] bg-[#121212] transition-[width] duration-200 ease-out",
            collapsed ? "w-[72px]" : "w-[260px]",
          )}
        >
          <div
            className={cn(
              "flex h-14 shrink-0 items-center border-b border-white/[0.06]",
              collapsed ? "justify-center px-2" : "justify-between px-4",
            )}
          >
            {!collapsed ? (
              <span className="text-sm font-semibold tracking-tight text-white">Home</span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              className={cn(
                "shrink-0 text-zinc-400 hover:bg-white/[0.06] hover:text-white",
                collapsed && "mx-auto",
              )}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronsLeft className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 border-b border-white/[0.06] py-3",
              collapsed ? "flex-col justify-center px-2" : "px-4",
            )}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A73E8] text-sm font-semibold text-white"
              aria-hidden
            >
              {initial}
            </div>
            {!collapsed ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{userLabel}</p>
                  <p className="truncate text-xs text-zinc-500">{roleLabel}</p>
                </div>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" aria-hidden />
                </button>
              </>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
            <WorkspaceNav collapsed={collapsed} />
          </div>

          <div
            className={cn(
              "border-t border-white/[0.06] p-2",
              collapsed ? "flex justify-center" : "flex justify-start",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[#0d0d0d]">
          <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#121212]/95 backdrop-blur-md">
            <div className="flex h-16 w-full items-center gap-3 px-4 sm:px-6">
              <div className="relative hidden min-w-0 flex-1 lg:block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden
                />
                <Input
                  type="search"
                  placeholder="Search for list, template, etc."
                  className="h-10 border-white/[0.08] bg-[#1e1e1e] pl-10 text-sm text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-[#1A73E8]"
                  aria-label="Search"
                />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3 lg:hidden">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#1e1e1e]">
                  <Building2 className="h-4 w-4 text-zinc-400" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{title}</p>
                  <p className="truncate text-xs text-zinc-500">{description}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className="hidden border-white/[0.12] bg-transparent text-zinc-400 sm:inline-flex"
                >
                  {roleLabel}
                </Badge>
                <Button
                  asChild
                  className="bg-[#1A73E8] px-4 text-white shadow-none hover:bg-[#1557b0]"
                >
                  <Link href="/admin">Create</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="hidden border-white/[0.12] bg-transparent text-white hover:bg-white/[0.06] sm:inline-flex"
                >
                  Customer Call
                </Button>
                <ThemeToggle />
                {actions}
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <main className="min-w-0 flex-1 overflow-auto px-4 py-8 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-6xl space-y-6">
                <div className="mb-2 hidden lg:block">
                  <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
                  <p className="mt-1 text-sm text-zinc-500">{description}</p>
                </div>
                {children}
              </div>
            </main>

            <aside className="hidden w-[300px] shrink-0 border-l border-white/[0.06] bg-[#121212] px-4 py-8 xl:block">
              <div className="space-y-6">
                <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#1a1a1a]">
                  <div className="h-28 bg-gradient-to-br from-[#1a73e8]/30 via-[#1e1e1e] to-[#0d47a1]/40" />
                  <div className="space-y-2 p-4">
                    <p className="text-sm font-semibold text-white">Check new feature available</p>
                    <p className="text-xs leading-relaxed text-zinc-500">
                      Explore billing insights and faster invoice exports from the workspace.
                    </p>
                    <a
                      href="https://codezerolabs.com.au"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1A73E8] hover:underline"
                    >
                      Open link
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Recommended</p>
                  <ul className="mt-4 space-y-4">
                    <li className="flex gap-3">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[#4db6ac]">
                        <Sparkles className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">Explore new templates</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Browse proposal templates aligned with your pricing tiers.
                        </p>
                        <Link
                          href="/dashboard"
                          className="mt-2 inline-block text-xs font-medium text-[#1A73E8] hover:underline"
                        >
                          Learn more
                        </Link>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[#4db6ac]">
                        <Building2 className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">Integrate with another app</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Connect Stripe and your CRM for a single source of truth.
                        </p>
                        <Link
                          href="/admin"
                          className="mt-2 inline-block text-xs font-medium text-[#1A73E8] hover:underline"
                        >
                          Learn more
                        </Link>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
