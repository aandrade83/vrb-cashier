import { NextResponse } from "next/server";
import { getMasterSession, setMasterActingCashier } from "@/lib/auth/session";

export async function POST() {
  const session = await getMasterSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await setMasterActingCashier(session.sessionToken, null);

  return NextResponse.json({ redirect: "/master/dashboard" });
}
