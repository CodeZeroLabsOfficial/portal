/**
 * Layout helpers for {@link WorkspaceShellLayout}.
 */

/** Workspace sticky header row (`h-12`). Keep in sync with `workspace-shell-layout`. */
export const WORKSPACE_TOPBAR_HEIGHT_REM = 3;

/**
 * Pass as `mainClassName` on `WorkspaceShell` so full-height builders (proposal editor,
 * library panels) sit flush under the top bar.
 */
export const WORKSPACE_MAIN_FLUSH_TOP_CLASS = "pt-0";
