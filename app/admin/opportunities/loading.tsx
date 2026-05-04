import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default function Loading() {
  return (
    <WorkspaceShell
      title="Pipeline"
      description="Loading opportunities…"
      roleLabel=""
      displayName=""
      userLabel=""
      showMainHeader={false}
      showRightAside={false}
      contentClassName="max-w-[1400px]"
    >
      <div className="animate-pulse space-y-4 rounded-xl border border-border/60 bg-muted/20 p-8">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-32 rounded-lg bg-muted/80" />
      </div>
    </WorkspaceShell>
  );
}
