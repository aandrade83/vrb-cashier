export default function PendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold">Setting up your account…</h1>
        <p className="text-muted-foreground">
          Your account is being configured. Please sign in again in a moment.
        </p>
        <a href="/sign-in" className="text-primary underline underline-offset-4">
          Back to sign in
        </a>
      </div>
    </div>
  );
}
