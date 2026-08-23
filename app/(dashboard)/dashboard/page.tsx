export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Dispatch</h1>
      <p className="text-muted-foreground">
        Internal admin and dispatch board. Auth-gated, built in a later phase.
      </p>
    </main>
  );
}
