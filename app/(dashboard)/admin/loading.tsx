export default function AdminLoading() {
  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-[110rem] items-center px-4 sm:px-6">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="ml-auto flex gap-1">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-8 w-20 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[110rem] px-4 py-6 sm:px-6">
        <div className="space-y-4">
          <div className="h-7 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-28 animate-pulse rounded-xl bg-muted" />
            <div className="h-28 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </main>
    </div>
  );
}
