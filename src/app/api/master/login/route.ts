import { NextRequest, NextResponse } from "next/server";
import {
  verifyMasterCredentials,
  createMasterSession,
  MASTER_SESSION_COOKIE,
} from "@/lib/master-auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = (await req.json()) as unknown;
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  if (!(await verifyMasterCredentials(email, password))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createMasterSession();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(MASTER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 8 * 60 * 60,
    path: "/",
  });

  return res;
}
