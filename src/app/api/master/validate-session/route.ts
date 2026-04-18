// Internal API used by middleware to validate master session tokens.

import { NextRequest, NextResponse } from "next/server";
import { getMasterSessionData } from "@/lib/master-auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await getMasterSessionData(token);

  if (!result.valid) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  return NextResponse.json({
    valid: true,
    actingCashierId: result.actingCashierId,
  });
}
