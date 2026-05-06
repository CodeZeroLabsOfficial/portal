/**
 * Re-export of {@link WorkspaceShellLayout} under its public/UX-facing name.
 *
 * The two used to be sibling components — `WorkspaceShell` was a 1:1 prop
 * passthrough wrapper around `WorkspaceShellLayout`. They are kept as separate
 * import paths because dozens of `app/**` routes reference `@/components/portal/workspace-shell`,
 * but the runtime component is now the same.
 */
export { WorkspaceShellLayout as WorkspaceShell } from "@/components/portal/workspace-shell-layout";
