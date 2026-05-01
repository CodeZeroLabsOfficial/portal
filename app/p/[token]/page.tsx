import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PublicProposalPageProps {
  params: Promise<{ token: string }>;
}

/**
 * Public proposal viewer — ISR-friendly shell. Load proposal by share token server-side,
 * sanitize HTML blocks, and emit analytics events from the client with rate limiting.
 */
export default async function PublicProposalPage(props: PublicProposalPageProps) {
  const params = await props.params;
  const token = params.token?.trim();

  if (!token || token.length < 8) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-16 sm:px-6">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Shared proposal</CardTitle>
          <CardDescription>
            Token <span className="font-mono text-xs">{token.slice(0, 12)}…</span> — fetch Firestore
            document by share token and render branded blocks here.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This route is intentionally public (no Firebase session required). Protect sensitive data
          with Firestore rules that only allow read by token hash or signed URLs from a Cloud
          Function.
        </CardContent>
      </Card>
    </main>
  );
}
