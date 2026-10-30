import { NextResponse, type NextRequest } from "next/server";
import { reconcileGroupPayment } from "@/lib/payments/group-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROUP_REF_PATTERN = /^NT-G-[ABCDEFGHJKLMNPQRTUVWXY2346789]{6}$/;

async function handle(request: NextRequest) {
  const groupRef = request.nextUrl.searchParams.get("ref")?.trim().toUpperCase();
  const origin = request.nextUrl.origin;
  if (!groupRef || !GROUP_REF_PATTERN.test(groupRef)) {
    return NextResponse.redirect(new URL("/", origin), { status: 303 });
  }
  try {
    // Never trust the gateway's return URL status; query PayToday server-side.
    await reconcileGroupPayment(groupRef);
  } catch (error) {
    console.error(`[payments] itinerary return handler failed for ${groupRef}`, error);
  }
  return NextResponse.redirect(new URL(`/quote/${encodeURIComponent(groupRef)}`, origin), { status: 303 });
}

export const GET = handle;
export const POST = handle;
