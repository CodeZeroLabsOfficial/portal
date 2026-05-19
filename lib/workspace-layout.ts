/**
 * Layout helpers for {@link WorkspaceShellLayout}.
 */

/** Workspace sticky header row (`h-12`). Keep in sync with `workspace-shell-layout`. */
export const WORKSPACE_TOPBAR_HEIGHT_REM = 3;

/**
 * Pass as `mainClassName` on `WorkspaceShell` to remove main-column top padding when a
 * panel should sit flush under the workspace top bar (e.g. full-bleed media library).
 * CRM detail and proposal builder pages use the default `py-8` instead.
 */
export const WORKSPACE_MAIN_FLUSH_TOP_CLASS = "pt-0";
