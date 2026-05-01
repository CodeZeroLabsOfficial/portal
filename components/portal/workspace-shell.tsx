import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { APP_NAME } from "@/lib/constants";
import { WorkspaceNav } from "@/components/portal/workspace-nav";

interface WorkspaceShellProps {
  title: string;
  description: string;
  roleLabel: string;
  userLabel: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function WorkspaceShell({
  title,
  description,
  roleLabel,
  userLabel,
  actions,
  children,
}: WorkspaceShellProps) {
  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="mx-auto flex w-full max-w-[1500px]">
        <aside className="sticky top-0 hidden h-dvh w-[290px] shrink-0 border-r border-border/70 bg-background/95 px-4 py-5 lg:block">
          <div className="mb-6 rounded-xl border border-border/70 bg-card p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Portal</p>
            <p className="mt-1 text-sm font-semibold tracking-tight">{APP_NAME}</p>
            <p className="mt-2 text-xs text-muted-foreground">Design-system driven CSM workspace shell.</p>
          </div>
          <WorkspaceNav />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card">
                  <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {roleLabel}
                </Badge>
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {userLabel}
                </Badge>
                <ThemeToggle />
                {actions}
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
