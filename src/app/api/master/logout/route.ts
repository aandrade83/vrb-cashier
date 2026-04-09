import { NextRequest, NextResponse } from "next/server";
import { deleteMasterSession, getMasterSessionFromCookies, MASTER_SESSION_COOKIE } from "@/lib/master-auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(MASTER_SESSION_COOKIE)?.value;

  if (token) {
    await deleteMasterSession(token);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(MASTER_SESSION_COOKIE);
  return res;
}
