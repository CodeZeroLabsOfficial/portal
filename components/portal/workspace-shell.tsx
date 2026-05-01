import type { ReactNode } from "react";
import { WorkspaceShellLayout } from "@/components/portal/workspace-shell-layout";

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
    <WorkspaceShellLayout
      title={title}
      description={description}
      roleLabel={roleLabel}
      userLabel={userLabel}
      actions={actions}
    >
      {children}
    </WorkspaceShellLayout>
  );
}
