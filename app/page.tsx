import { buildAuthorizeUrl } from "@/lib/auth/cognito";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  const signInUrl = buildAuthorizeUrl(params.returnTo);

  const errorMessages: Record<string, string> = {
    auth_failed: "Authentication failed. Please try again.",
    no_code: "Sign-in was cancelled or incomplete. Please try again.",
  };

  const errorMessage = params.error ? errorMessages[params.error] : null;

  return (
    <main
      id="main-content"
      role="main"
      className="flex min-h-screen items-center justify-center bg-canvas p-4"
    >
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-bold tracking-tight">
            Requirements Foundry
          </CardTitle>
          <CardDescription className="text-base">
            Transform use cases into JIRA-ready epics and user stories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
          <Button asChild size="lg" className="w-full">
            <a href={signInUrl}>Sign in</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
