import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage(props: LoginPageProps) {
  const searchParams = await props.searchParams;
  const nextPath = searchParams.next ?? "/dashboard";
  const currentUser = await getCurrentSessionUser();
  if (currentUser) {
    redirect(nextPath);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Use the same Firebase account as the iOS app. Session cookies are issued after a
              successful ID token exchange on the server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <LoginForm nextPath={nextPath} />
            <p className="text-center text-xs text-muted-foreground">
              Trouble signing in?{" "}
              <Link href="/" className="underline underline-offset-4">
                Back to home
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
