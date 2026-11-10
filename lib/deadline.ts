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
 * ## The timer cannot cancel the query, so the socket must be abandoned
 *
 * Nothing in postgres.js cancels a query in flight, so when this rejects the
 * connection underneath it is still busy. With one connection per instance
 * (`max: 1` in db/index.ts) that is fatal in a way that took a production log
 * to see: every later query on that warm instance queues behind the dead
 * socket, each dies at its own deadline, and anything without a deadline —
 * the save that writes a quote — hangs until Vercel kills the function at
 * five minutes. The instance stays like that for `max_lifetime`, half an hour.
 * /admin/bookings logging seven identical "did not answer within 6000ms"
 * lines in the same second is what that looks like from outside.
 *
 * So exceeding a deadline is not only an error to report: it is a signal that
 * the connection is gone. Listeners registered with `onDeadlineExceeded` are
 * told, and the database module uses that to retire the pool, so the next
 * query opens a fresh socket instead of waiting for a dead one. That costs a
 * reconnect — a few hundred milliseconds against Supabase — once per stall,
 * which is the right price for an instance that recovers in seconds rather
 * than minutes.
 */
export class DeadlineExceeded extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not answer within ${ms}ms`);
    this.name = "DeadlineExceeded";
  }
}

type DeadlineListener = (error: DeadlineExceeded) => void;

const listeners = new Set<DeadlineListener>();

/**
 * Be told whenever any deadline is exceeded. Returns a function that removes
 * the listener again. Listeners must not throw; a listener that does is
 * dropped from the notification, never from the caller's error path.
 */
export function onDeadlineExceeded(listener: DeadlineListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(error: DeadlineExceeded): void {
  for (const listener of listeners) {
    try {
      listener(error);
    } catch (listenerError) {
      console.error("[deadline] listener failed", listenerError);
    }
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
        timer = setTimeout(() => {
          const error = new DeadlineExceeded(label, ms);
          notify(error);
          reject(error);
        }, ms);
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

/**
 * The budget a write gets — a quote being saved, a draft being issued.
 *
 * Longer than a read because a save is several statements in one transaction
 * and may be queued behind a stall it did not cause, but still a small
 * fraction of the function's life: a write that has not answered in fifteen
 * seconds is not going to, and the operator needs to be told that in time to
 * check what happened and try again, not shown a 504 five minutes later.
 */
export const WRITE_DEADLINE_MS = 15_000;
