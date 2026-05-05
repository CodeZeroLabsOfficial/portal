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
  /** Replaces the default right column (xl+) when set. */
  rightAside?: ReactNode;
  /** When false, the xl+ right sidebar is hidden. */
  showRightAside?: boolean;
  /** When false, the large title + description block above page content is omitted. */
  showMainHeader?: boolean;
  /** Extra classes merged onto the inner content wrapper (default is full-width, edge-aligned). */
  contentClassName?: string;
  /** Narrow column between the primary sidebar and main content (e.g. Settings submenu). */
  secondaryNav?: ReactNode;
  children: ReactNode;
}

export function WorkspaceShell({
  title,
  description,
  roleLabel,
  userLabel,
  displayName,
  rightAside,
  showRightAside = true,
  showMainHeader = true,
  contentClassName,
  secondaryNav,
  children,
}: WorkspaceShellProps) {
  return (
    <WorkspaceShellLayout
      title={title}
      description={description}
      roleLabel={roleLabel}
      userLabel={userLabel}
      displayName={displayName}
      rightAside={rightAside}
      showRightAside={showRightAside}
      showMainHeader={showMainHeader}
      contentClassName={contentClassName}
      secondaryNav={secondaryNav}
    >
      {children}
    </WorkspaceShellLayout>
  );
}
