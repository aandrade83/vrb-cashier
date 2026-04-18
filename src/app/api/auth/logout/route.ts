import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroyUserSession, USER_SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  let cashierSlug: string | null = null;
  let cashierToken: string | null = null;

  try {
    const body = await req.json();
    cashierSlug = body.slug ?? null;
    cashierToken = body.token ?? null;
  } catch {
    // body may be empty — fall through
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;

  if (token) {
    await destroyUserSession(token);
  }

  cookieStore.delete(USER_SESSION_COOKIE);

  const redirectPath =
    cashierSlug && cashierToken ? `/${cashierSlug}/${cashierToken}/` : "/";

  return NextResponse.json({ redirect: redirectPath });
}
