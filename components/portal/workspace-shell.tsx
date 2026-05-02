import type { ReactNode } from "react";
import { WorkspaceShellLayout } from "@/components/portal/workspace-shell-layout";

interface WorkspaceShellProps {
  title: string;
  description: string;
  roleLabel: string;
  /** Email or uid — used for avatar fallback, tooltips, and when `displayName` is empty. */
  userLabel: string;
  /** Shown in the top bar above `roleLabel`; falls back to `userLabel` when blank. */
  displayName?: string;
  children: ReactNode;
}

export function WorkspaceShell({
  title,
  description,
  roleLabel,
  userLabel,
  displayName,
  children,
}: WorkspaceShellProps) {
  return (
    <WorkspaceShellLayout
      title={title}
      description={description}
      roleLabel={roleLabel}
      userLabel={userLabel}
      displayName={displayName}
    >
      {children}
    </WorkspaceShellLayout>
  );
}
