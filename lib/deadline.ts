import "server-only";

/**
 * A hard ceiling on how long a read may take.
 *
 * `connect_timeout` covers a pooler that will not accept a connection. It does
 * nothing for a connection that is accepted and then never answers — a query
 * queued behind a lock, a pooler at its limit handing out a socket it cannot
 * service, a network path that silently stalls. Those hang until the serverless
 * function is killed, and the operator is shown
 * `504 FUNCTION_INVOCATION_TIMEOUT`, which names nothing and suggests nothing.
 *
 * Losing one panel is a bad afternoon. Losing the page that confirms payments,
 * with no clue why, is the failure this project keeps writing rules against:
 * degrade loudly, not silently.
 *
 * The timer does not cancel the query — nothing in postgres.js does — so the
 * connection is still busy when this rejects. That is deliberate and it is the
 * lesser evil: the request returns, the catch runs, and the page renders with
 * one panel missing and a banner saying so.
 */
export class DeadlineExceeded extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not answer within ${ms}ms`);
    this.name = "DeadlineExceeded";
  }
}

export async function withDeadline<T>(
  label: string,
  ms: number,
  work: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DeadlineExceeded(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The budget one admin panel gets.
 *
 * Vercel's default function limit is what the 504 was hitting, so every read
 * on a page must finish well inside it with room for the others. Six seconds
 * is longer than any of these queries takes against a healthy database by more
 * than an order of magnitude.
 */
export const READ_DEADLINE_MS = 6_000;
