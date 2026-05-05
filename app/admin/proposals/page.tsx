import Link from "next/link";
import { redirect } from "next/navigation";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";
import { listProposalTemplatesForOrg } from "@/server/firestore/proposal-templates";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { NewProposalTemplateButton } from "@/components/proposal/new-proposal-template-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminProposalsHubPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/proposals");
  }
  if (!hasRole(user, ["admin", "team"])) {
    redirect("/dashboard");
  }

  const templates = await listProposalTemplatesForOrg(user);

  return (
    <WorkspaceShell
      title="Proposals"
      description="Create, send, and track dynamic digital proposals."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem] md:leading-tight">
              Proposals
            </h1>
          </motion.div>
          <NewProposalTemplateButton />
        </div>

        {templates.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-muted/20">
            <CardHeader>
              <CardTitle className="text-base">No templates yet</CardTitle>
              <CardDescription>Create one to speed up proposals from the CRM.</CardDescription>
            </CardHeader>
            <CardContent>
              <NewProposalTemplateButton />
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <li key={t.id}>
                <Card className="border-border/80 bg-card/60 transition-colors hover:bg-card">
                  <CardHeader className="space-y-2 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-2 text-base leading-snug">{t.name}</CardTitle>
                      <Badge variant="outline" className="shrink-0 font-normal capitalize">
                        Template
                      </Badge>
                    </div>
                    {t.description?.trim() ? (
                      <CardDescription className="line-clamp-2">{t.description.trim()}</CardDescription>
                    ) : (
                      <CardDescription className="italic text-muted-foreground/80">No description</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2 pt-0">
                    <Button variant="secondary" size="sm" className="gap-1.5" asChild>
                      <Link href={`/admin/proposals/templates/${t.id}`}>
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </WorkspaceShell>
  );
}
