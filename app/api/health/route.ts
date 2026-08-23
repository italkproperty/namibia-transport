import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe — also keeps the api/ route-handler surface in place. */
export function GET() {
  return NextResponse.json({ ok: true });
}
