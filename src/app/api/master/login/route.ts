import { NextRequest, NextResponse } from "next/server";
import { verifyMasterCredentials, createMasterSession, MASTER_SESSION_COOKIE } from "@/lib/master-auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json() as unknown;
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  if (!verifyMasterCredentials(email, password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createMasterSession();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(MASTER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60, // 8 hours
    path: "/",
  });

  return res;
}
