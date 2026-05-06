"use client";

import type { ReactNode } from "react";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  LogOut,
  Search,
  Sparkles,
} from "lucide-react";
import { signOutFromPortal } from "@/components/auth/logout-button";
import { ThemeMenuItems } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddCustomerModal } from "@/components/portal/add-customer-modal";
import { WorkspaceNav } from "@/components/portal/workspace-nav";
import {
  WORKSPACE_MAIN_COLUMN_DESCRIPTION_CLASS,
  WORKSPACE_MAIN_COLUMN_TITLE_CLASS,
} from "@/lib/workspace-page-typography";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "portal-sidebar-collapsed";

/** Matches `<main>` horizontal padding; negative margin lets content span the full main column. */
const WORKSPACE_MAIN_CONTENT_CLASS =
  "w-full min-w-0 max-w-none space-y-6 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8";

interface WorkspaceShellLayoutProps {
  title: string;
  description: string;
  roleLabel: string;
  userLabel: string;
  displayName?: string;
  rightAside?: ReactNode;
  /** When false, the xl+ right sidebar column is not rendered. */
  showRightAside?: boolean;
  showMainHeader?: boolean;
  contentClassName?: string;
  secondaryNav?: ReactNode;
  children: ReactNode;
}

function DefaultWorkspaceRightAside() {
  return (
    <>
      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#1a1a1a]">
        <div className="h-28 bg-gradient-to-br from-primary/35 via-[#1e1e1e] to-primary/25" />
        <div className="space-y-2 p-4">
          <p className="text-sm font-semibold text-white">Check new feature available</p>
          <p className="text-xs leading-relaxed text-zinc-500">
            Explore billing insights and faster invoice exports from the workspace.
          </p>
          <a
            href="https://codezerolabs.com.au"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
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
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-primary">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-white">Explore new templates</p>
              <p className="mt-1 text-xs text-zinc-500">
                Browse proposal templates aligned with your pricing tiers.
              </p>
              <Link
                href="/dashboard"
                className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
              >
                Learn more
              </Link>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-primary">
              <Building2 className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-white">Integrate with another app</p>
              <p className="mt-1 text-xs text-zinc-500">
                Connect Stripe and your CRM for a single source of truth.
              </p>
              <Link
                href="/admin"
                className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
              >
                Learn more
              </Link>
            </div>
          </li>
        </ul>
      </div>
    </>
  );
}

export function WorkspaceShellLayout({
  title,
  description,
  roleLabel,
  userLabel,
  displayName = "",
  rightAside,
  showRightAside = true,
  showMainHeader = true,
  contentClassName,
  secondaryNav,
  children,
}: WorkspaceShellLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  const [collapsed, setCollapsed] = React.useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = React.useState(false);

  async function handleSignOut() {
    await signOutFromPortal();
    router.replace("/login");
    router.refresh();
  }

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

  const nameHeadline = displayName.trim() ? displayName.trim() : userLabel.trim();

  const initial = React.useMemo(() => {
    const source = displayName.trim() || userLabel.trim();
    const ch = source.charAt(0);
    return ch ? ch.toUpperCase() : "?";
  }, [displayName, userLabel]);

  const avatarTitle = React.useMemo(() => {
    if (displayName.trim() && userLabel.trim() && userLabel.trim() !== nameHeadline) {
      return `${nameHeadline} · ${userLabel.trim()}`;
    }
    return nameHeadline;
  }, [displayName, userLabel, nameHeadline]);

  const portalHomeHref = roleLabel === "admin" || roleLabel === "team" ? "/admin" : "/dashboard";

  return (
    <TooltipProvider delayDuration={0}>
      {isAdminRoute ? (
        <AddCustomerModal open={addCustomerOpen} onOpenChange={setAddCustomerOpen} />
      ) : null}
      <div className="portal-ui flex min-h-dvh w-full text-[15px] antialiased">
        <aside
          aria-label="Workspace"
          className={cn(
            "sticky top-0 flex h-dvh shrink-0 flex-col border-r border-white/[0.06] bg-[#0D0D16] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] transition-[width] duration-200 ease-out",
            collapsed ? "w-[72px]" : "w-[260px]",
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-center",
              collapsed
                ? "flex-col gap-2 px-3 pb-3 pt-3"
                : "h-14 justify-between px-4",
            )}
          >
            {!collapsed ? (
              <Link
                href={portalHomeHref}
                className="min-w-0 flex-1 pr-2 outline-none ring-offset-2 ring-offset-[#0D0D16] focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Code Zero Labs home"
              >
                <Image
                  src="/brand/logo-expanded.png"
                  alt="Code Zero Labs"
                  width={200}
                  height={48}
                  className="h-8 w-auto max-w-full object-contain object-left"
                  priority
                />
              </Link>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={portalHomeHref}
                    className="flex shrink-0 items-center justify-center rounded-lg outline-none ring-offset-2 ring-offset-[#0D0D16] focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Code Zero Labs home"
                  >
                    <Image
                      src="/brand/logo-collapsed.png"
                      alt=""
                      width={36}
                      height={36}
                      className="h-9 w-9 object-contain"
                      priority
                    />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="border-white/[0.08] bg-[#1e1e1e] text-white">
                  Home
                </TooltipContent>
              </Tooltip>
            )}
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

          <div className="flex min-h-0 flex-1 flex-col px-2 pb-4 pt-2">
            <WorkspaceNav collapsed={collapsed} userRole={roleLabel} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[#0D0D16]">
          <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0D0D16]/95 backdrop-blur-md">
            <div className="flex h-14 w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
              <div className="relative hidden min-w-0 flex-1 lg:block">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 stroke-[1.5] text-zinc-400"
                  aria-hidden
                />
                <Input
                  type="search"
                  placeholder={isAdminRoute ? "Search..." : "Search for list, template, etc."}
                  className="h-9 max-w-xl rounded-full border-white/[0.08] bg-[#1e1e1e] pl-10 pr-4 text-[14px] font-medium leading-none text-white shadow-none placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Search"
                />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3 lg:hidden">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#1e1e1e]">
                  <Building2 className="h-[18px] w-[18px] stroke-[1.5] text-zinc-400" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium leading-none text-white">{title}</p>
                  <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                    {description}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                {isAdminRoute ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        className="h-9 gap-1.5 rounded-lg bg-primary px-4 text-[14px] font-medium text-primary-foreground shadow-none hover:bg-primary/90"
                      >
                        Create
                        <ChevronDown className="h-[18px] w-[18px] shrink-0 stroke-[1.5] opacity-90" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-[12rem] border-white/[0.08] bg-[#1e1e1e] text-zinc-100 shadow-lg"
                    >
                      <DropdownMenuLabel className="text-xs font-medium text-zinc-500">Create</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/[0.08]" />
                      <DropdownMenuItem
                        className="cursor-pointer text-zinc-200 focus:bg-white/[0.08] focus:text-white"
                        onSelect={() => setAddCustomerOpen(true)}
                      >
                        New customer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-zinc-200 focus:bg-white/[0.08] focus:text-white"
                        asChild
                      >
                        <Link href="/admin/customers">New subscription</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-zinc-200 focus:bg-white/[0.08] focus:text-white"
                        asChild
                      >
                        <Link href="/admin/opportunities">New proposal</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-zinc-200 focus:bg-white/[0.08] focus:text-white"
                        asChild
                      >
                        <Link href="/admin/tasks">New task</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="ghost"
                    className="inline-flex h-9 gap-2 rounded-lg px-3 text-[14px] font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                    asChild
                  >
                    <Link href="#">
                      <Bell className="h-[18px] w-[18px] shrink-0 stroke-[1.5]" aria-hidden />
                      <span className="hidden sm:inline">Notifications</span>
                    </Link>
                  </Button>
                )}
                <div className="ml-0.5 border-l border-white/[0.08] pl-2 sm:ml-1 sm:pl-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        title={avatarTitle}
                        aria-label={`Account menu for ${nameHeadline}`}
                        className="flex max-w-full items-center gap-2 rounded-lg border border-transparent px-1.5 py-0.5 text-left transition-colors hover:border-white/[0.08] hover:bg-white/[0.06] sm:gap-2.5 sm:px-2"
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-semibold text-primary-foreground"
                          aria-hidden
                        >
                          {initial}
                        </div>
                        <div className="hidden min-w-0 flex-1 sm:block">
                          <p className="max-w-[140px] truncate text-[14px] font-medium leading-none text-white md:max-w-[220px]">
                            {nameHeadline}
                          </p>
                          <p className="max-w-[140px] truncate text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500 md:max-w-[220px]">
                            {roleLabel.toUpperCase()}
                          </p>
                        </div>
                        <ChevronDown className="h-[18px] w-[18px] shrink-0 stroke-[1.5] text-zinc-400" aria-hidden />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-[14rem] border-white/[0.08] bg-[#1e1e1e] text-zinc-100 shadow-lg"
                    >
                      <DropdownMenuLabel className="font-semibold text-white">{nameHeadline}</DropdownMenuLabel>
                      {userLabel.trim() && userLabel.trim() !== nameHeadline ? (
                        <p className="px-2 pb-1.5 text-xs leading-snug text-zinc-500">{userLabel.trim()}</p>
                      ) : null}
                      <DropdownMenuSeparator className="bg-white/[0.08]" />
                      <ThemeMenuItems />
                      <DropdownMenuSeparator className="bg-white/[0.08]" />
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-zinc-200 focus:bg-white/[0.08] focus:text-white"
                        onSelect={() => {
                          void handleSignOut();
                        }}
                      >
                        <LogOut className="h-4 w-4" aria-hidden />
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </header>

          <div
            className={cn(
              "flex min-h-0 flex-1",
              secondaryNav ? "flex-col md:flex-row" : "",
            )}
          >
            {secondaryNav ? (
              <div className="shrink-0 border-b border-white/[0.06] bg-[#111118] md:w-[232px] md:border-b-0 md:border-r">
                {secondaryNav}
              </div>
            ) : null}
            <main className="min-w-0 flex-1 overflow-auto px-4 py-8 sm:px-6 lg:px-8">
              <div className={cn(WORKSPACE_MAIN_CONTENT_CLASS, contentClassName)}>
                {showMainHeader ? (
                  <div className="mb-2 hidden lg:block">
                    <h1 className={WORKSPACE_MAIN_COLUMN_TITLE_CLASS}>{title}</h1>
                    <p className={WORKSPACE_MAIN_COLUMN_DESCRIPTION_CLASS}>{description}</p>
                  </div>
                ) : null}
                {children}
              </div>
            </main>

            {showRightAside ? (
              <aside className="hidden w-[300px] shrink-0 border-l border-white/[0.06] bg-[#0D0D16] px-4 py-8 sm:px-6 lg:px-8 xl:block">
                <div className="space-y-6">{rightAside ?? <DefaultWorkspaceRightAside />}</div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
